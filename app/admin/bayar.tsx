// FILE: app/admin/bayar.tsx
import React, { useMemo, useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  Platform,
  Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

// ✅ Safe Area
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ✅ Image Picker (Expo)
import * as ImagePicker from "expo-image-picker";

// ✅ Compress/Resize + Base64
import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system/legacy";

// ✅ Firebase
import { db, auth } from "../../firebase";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  where,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";

const THEME = {
  bg1: "#BFE9FF",
  bg2: "#EAF6FF",
  bg3: "#F7FBFF",
  text: "#0F172A",
  sub: "#64748B",
  border: "#E2E8F0",
  card: "rgba(255,255,255,0.92)",
  primary: "#0EA5E9",
};

type Student = {
  id: string;
  name: string;
  type: "Normal" | "Beasiswa 0" | "Beasiswa 100" | "Pertemuan";
  spp: number;
  pertemuan?: number;
};

type Hadiah = { id: string; label: string; nominal: number; peluang: number };

type InvoiceDraft = {
  paymentGroupId: string;

  studentId: string;
  studentName: string;
  studentType: Student["type"];

  branchId: string;
  branchName: string;

  monthKeys: string[]; // ["YYYY-MM", ...]
  monthLabels: string[]; // ["Januari 2026", ...]

  nominal: number; // total nominal (bulan * spp)
  potongan: number; // total potongan dari kupon (bulan-bulan yang dibayar)
  total: number;

  metode: "Cash" | "Transfer";

  status: "UNPAID" | "PAID";
  createdAtLocal: Date;
  paidAtText?: string;

  proofDataUrl?: string | null;
  proofMime?: string | null;
  proofType?: "camera" | "gallery" | null;
};

type ProofLocal = {
  uri: string;
  dataUrl: string;
  mime: string;
  source: "camera" | "gallery";
  bytesApprox?: number;
};

function rupiah(n: number) {
  return "Rp " + Number(n || 0).toLocaleString("id-ID");
}
function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function monthKeyOf(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}
function monthLabelOf(d: Date) {
  const bulan = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];
  return `${bulan[d.getMonth()]} ${d.getFullYear()}`;
}
function formatTanggalJam(d: Date) {
  return `${pad2(d.getDate())}-${pad2(
    d.getMonth() + 1
  )}-${d.getFullYear()}  ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

// ✅ spreadsheet
function formatTanggalOnly(d: Date) {
  return `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()}`;
}
function formatJamOnly(d: Date) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

// ✅ helper invoiceNo (konsisten)
function invoiceNoOf(branchId: string, monthKey: string, studentId: string) {
  return `INV-${branchId}-${monthKey}-${studentId}`;
}

function addOneMonthKey(monthKey: string) {
  const [yStr, mStr] = monthKey.split("-");
  const y = Number(yStr);
  const m = Number(mStr); // 1..12
  const d = new Date(y, m - 1 + 1, 1); // +1 bulan
  return monthKeyOf(d);
}

/**
 * ✅ Push pembayaran ke Google Sheet via Apps Script WebApp
 */
async function pushPaymentToSheet(payload: {
  branchId: string;
  branchName: string;
  invoiceNo: string;
  tanggal: string;
  jam: string;
  studentName: string;
  jenisPembayaran: string;
  metode: "Cash" | "Transfer";
  nominal: number;
  voucherDipakai: number;
  voucherDidapat: number;
  monthKey?: string;
  createdAtIso?: string;
}) {
  const WEBAPP_URL =
    "https://script.google.com/macros/s/AKfycbxSDNL665Co4ybElVFG3KSu8f8UBMDwTGCtI9Tw_IUNDef_pUczNBDWZu8d0ESl4el_og/exec";

  try {
    const res = await fetch(WEBAPP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const raw = await res.text();
    console.log("push sheet status:", res.status);
    console.log("push sheet raw:", raw);

    let data: any = null;
    try {
      data = JSON.parse(raw);
    } catch {
      data = null;
    }

    if (!res.ok || !data?.ok) {
      console.log("push sheet gagal:", data || raw);
      return false;
    }

    console.log("push sheet sukses:", data);
    return true;
  } catch (err) {
    console.log("push sheet error:", err);
    return false;
  }
}

// random sesuai peluang
function pickByWeight(items: Hadiah[]) {
  const clean = items
    .map((x) => ({
      ...x,
      peluang: Number(x.peluang || 0),
      nominal: Number(x.nominal || 0),
    }))
    .filter((x) => x.peluang > 0);

  if (clean.length === 0) return null;

  const total = clean.reduce((a, b) => a + b.peluang, 0);
  let r = Math.random() * total;

  for (const it of clean) {
    r -= it.peluang;
    if (r <= 0) return it;
  }
  return clean[clean.length - 1];
}

// ✅ Convert image URI -> resized/compressed -> base64 dataUrl
async function makeProofDataUrl(
  uri: string,
  opts?: { maxWidth?: number; compress?: number }
) {
  const maxWidth = opts?.maxWidth ?? 720;
  const compress = opts?.compress ?? 0.5;

  const manip = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: maxWidth } }],
    { compress, format: ImageManipulator.SaveFormat.JPEG }
  );

  const b64 = await FileSystem.readAsStringAsync(manip.uri, {
    encoding: "base64" as any,
  });

  const bytesApprox = Math.floor((b64.length * 3) / 4);
  const dataUrl = `data:image/jpeg;base64,${b64}`;

  return { dataUrl, uri: manip.uri, mime: "image/jpeg", bytesApprox };
}

export default function BayarSPP() {
  const insets = useSafeAreaInsets();

  const today = new Date();
  const day = today.getDate();
  const year = today.getFullYear();
  const currentMonthKey = monthKeyOf(new Date(year, today.getMonth(), 1));

  // ===================== SETTING SPIN =====================
  const [spinLoading, setSpinLoading] = useState(true);
  const [sebelumTanggal, setSebelumTanggal] = useState(11);
  const [dipakaiBulanDepan, setDipakaiBulanDepan] = useState(true);
  const [hadiah, setHadiah] = useState<Hadiah[]>([]);
  const canSpinToday = day < sebelumTanggal;

  useEffect(() => {
    (async () => {
      try {
        const refx = doc(db, "spin_settings", "global");
        const snap = await getDoc(refx);

        if (snap.exists()) {
          const data = snap.data() as any;
          const st = Number(data.sebelumTanggal ?? 11);
          setSebelumTanggal(Number.isFinite(st) ? st : 11);
          setDipakaiBulanDepan(data.dipakaiBulanDepan !== false);

          const arr = Array.isArray(data.hadiah) ? data.hadiah : [];
          const parsed: Hadiah[] = arr.map((h: any, idx: number) => ({
            id: String(h.id || `H${idx + 1}`),
            label: String(h.label || ""),
            nominal: Number(h.nominal || 0),
            peluang: Number(h.peluang || 0),
          }));
          setHadiah(
            parsed.length
              ? parsed
              : [{ id: "H1", label: "Zonk", nominal: 0, peluang: 100 }]
          );
        } else {
          setSebelumTanggal(11);
          setDipakaiBulanDepan(true);
          setHadiah([{ id: "H1", label: "Zonk", nominal: 0, peluang: 100 }]);
        }
      } catch (e) {
        console.log(e);
        setSebelumTanggal(11);
        setDipakaiBulanDepan(true);
        setHadiah([{ id: "H1", label: "Zonk", nominal: 0, peluang: 100 }]);
      } finally {
        setSpinLoading(false);
      }
    })();
  }, []);

  // ===================== CABANG ADMIN LOGIN =====================
  const [branchId, setBranchId] = useState<string>("");
  const [branchName, setBranchName] = useState<string>("-");
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setProfileLoading(true);

        const u = auth.currentUser;
        if (!u) {
          if (mounted) {
            setBranchId("");
            setBranchName("-");
          }
          return;
        }

        const uSnap = await getDoc(doc(db, "users", u.uid));
        if (!uSnap.exists()) {
          Alert.alert("Gagal", "Data akun tidak ditemukan.");
          if (mounted) {
            setBranchId("");
            setBranchName("-");
          }
          return;
        }

        const data = uSnap.data() as any;

        const role = String(data.role || "").trim();
        if (role !== "ADMIN_CABANG" && role !== "SUPERADMIN") {
          Alert.alert("Akses ditolak", "Akun ini bukan admin cabang.");
          if (mounted) {
            setBranchId("");
            setBranchName("-");
          }
          return;
        }

        if (data.active === false) {
          Alert.alert("Akun Nonaktif", "Akun kamu sedang dinonaktifkan.");
          if (mounted) {
            setBranchId("");
            setBranchName("-");
          }
          return;
        }

        const bid = String(data.cabangId || data.branchId || "").trim();
        if (!bid) {
          Alert.alert(
            "Cabang belum diset",
            "Akun admin ini belum punya cabangId/branchId. Set dulu dari SUPERADMIN."
          );
          if (mounted) {
            setBranchId("");
            setBranchName("-");
          }
          return;
        }

        if (!mounted) return;
        setBranchId(bid);

        const bSnap = await getDoc(doc(db, "branches", bid));
        if (bSnap.exists()) {
          const b = bSnap.data() as any;
          setBranchName(String(b.name || b.branchName || "-").trim() || "-");
        } else {
          setBranchName(
            String(data.branchName || data.cabangName || "-") || "-"
          );
        }
      } catch (e: any) {
        console.log(e);
        Alert.alert("Gagal", e?.message || "Tidak bisa memuat profil admin.");
      } finally {
        if (mounted) setProfileLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // ===================== SISWA REALTIME =====================
  const [students, setStudents] = useState<Student[]>([]);
  const [studentLoading, setStudentLoading] = useState(true);

  useEffect(() => {
    if (!branchId) {
      setStudents([]);
      setStudentLoading(false);
      return;
    }

    setStudentLoading(true);

    const qRef = query(
      collection(db, "students"),
      where("branchId", "==", branchId),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const rows: Student[] = snap.docs.map((d) => {
          const data = d.data() as any;

          const typeRaw = String(data.type || data.tipe || "Normal");
          const type: Student["type"] =
            typeRaw === "Pertemuan"
              ? "Pertemuan"
              : typeRaw === "Beasiswa 0"
              ? "Beasiswa 0"
              : typeRaw === "Beasiswa 100"
              ? "Beasiswa 100"
              : "Normal";

          return {
            id: d.id,
            name: String(data.name || data.nama || "").trim(),
            type,
            spp: Number(data.sppDefault ?? data.spp ?? 0) || 0,
            pertemuan:
              data.pertemuan != null ? Number(data.pertemuan || 0) : undefined,
          };
        });

        setStudents(rows);
        setStudentLoading(false);
      },
      (err) => {
        console.log(err);
        setStudentLoading(false);
        Alert.alert("Gagal", "Tidak bisa mengambil data siswa.");
      }
    );

    return () => unsub();
  }, [branchId]);

  // ===================== SEARCH =====================
  const [queryText, setQueryText] = useState("");
  const filtered = useMemo(() => {
    const qq = queryText.trim().toLowerCase();
    if (!qq) return students;
    return students.filter((s) => s.name.toLowerCase().includes(qq));
  }, [queryText, students]);

  // ===================== BULAN OPSI (JAN - DES) =====================
  const monthOptions = useMemo(() => {
    // ✅ selalu 1 tahun penuh (Jan–Dec) supaya tidak berhenti di Juni
    return Array.from({ length: 12 }).map((_, i) => {
      const d = new Date(year, i, 1);
      return { key: monthKeyOf(d), label: monthLabelOf(d) };
    });
  }, [year]);

  // ===================== INVOICE MODAL STATE =====================
  const [selected, setSelected] = useState<Student | null>(null);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceDraft, setInvoiceDraft] = useState<InvoiceDraft | null>(null);

  const [payLoading, setPayLoading] = useState(false);

  // ✅ bukti pembayaran
  const [proofLocal, setProofLocal] = useState<ProofLocal | null>(null);
  const [processingProof, setProcessingProof] = useState(false);

  // ✅ spin state (legacy text)
  const [spinBonusLoading, setSpinBonusLoading] = useState(false);
  const [spinBonusText, setSpinBonusText] = useState("");
  const [spinDoneKeys, setSpinDoneKeys] = useState<string[]>([]);

  // ✅ PRE-SPIN (baru): 1x sebelum bayar untuk bulan depan
  const [preSpinLoading, setPreSpinLoading] = useState(false);
  const [preSpinDone, setPreSpinDone] = useState(false);
  const [preSpinMonthKey, setPreSpinMonthKey] = useState<string | null>(null);
  const [preSpinMonthLabel, setPreSpinMonthLabel] = useState<string>("");
  const [preSpinNominal, setPreSpinNominal] = useState<number>(0);

  // ✅ status bulan terbayar
  const [paidMonths, setPaidMonths] = useState<
    Record<string, { paid: boolean; paidAtText?: string }>
  >({});

  // ✅ dropdown modal bulan
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);

  const showLoading = profileLoading || studentLoading;

  // ✅ target kupon BARU: hanya 1x untuk bulan setelah bulan terakhir yang dipilih
  const spinNextMonthKey = useMemo(() => {
    if (!invoiceDraft?.monthKeys?.length) return null;
    const last = invoiceDraft.monthKeys[invoiceDraft.monthKeys.length - 1];
    return addOneMonthKey(last);
  }, [invoiceDraft?.monthKeys]);

  const spinNextMonthLabel = useMemo(() => {
    if (!spinNextMonthKey) return "";
    const found = monthOptions.find((m) => m.key === spinNextMonthKey);
    return found?.label || spinNextMonthKey;
  }, [spinNextMonthKey, monthOptions]);

  async function ensurePerms() {
    const lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (lib.status !== "granted") {
      Alert.alert(
        "Izin dibutuhkan",
        "Izinkan akses galeri untuk upload bukti."
      );
      return false;
    }
    const cam = await ImagePicker.requestCameraPermissionsAsync();
    if (cam.status !== "granted") {
      // kamera boleh tidak granted
    }
    return true;
  }

  async function pickFromGallery() {
    try {
      const ok = await ensurePerms();
      if (!ok) return;

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 1,
      });

      if (res.canceled) return;

      const a = res.assets?.[0];
      if (!a?.uri) return;

      setProcessingProof(true);
      const made = await makeProofDataUrl(a.uri, {
        maxWidth: 720,
        compress: 0.5,
      });

      if (made.bytesApprox > 850_000) {
        Alert.alert(
          "Peringatan",
          "Ukuran bukti masih besar. Kalau nanti gagal simpan, coba foto ulang / pilih gambar lebih kecil."
        );
      }

      setProofLocal({
        uri: made.uri,
        dataUrl: made.dataUrl,
        mime: made.mime,
        source: "gallery",
        bytesApprox: made.bytesApprox,
      });
    } catch (e: any) {
      console.log(e);
      Alert.alert("Gagal", e?.message || "Tidak bisa memilih gambar.");
    } finally {
      setProcessingProof(false);
    }
  }

  async function takePhoto() {
    try {
      const cam = await ImagePicker.requestCameraPermissionsAsync();
      if (cam.status !== "granted") {
        Alert.alert("Izin kamera", "Izinkan akses kamera untuk foto bukti.");
        return;
      }

      const res = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 1,
      });

      if (res.canceled) return;

      const a = res.assets?.[0];
      if (!a?.uri) return;

      setProcessingProof(true);
      const made = await makeProofDataUrl(a.uri, {
        maxWidth: 900,
        compress: 0.6,
      });

      if (made.bytesApprox > 850_000) {
        Alert.alert(
          "Peringatan",
          "Ukuran bukti masih besar. Kalau nanti gagal simpan, coba foto ulang / pilih gambar lebih kecil."
        );
      }

      setProofLocal({
        uri: made.uri,
        dataUrl: made.dataUrl,
        mime: made.mime,
        source: "camera",
        bytesApprox: made.bytesApprox,
      });
    } catch (e: any) {
      console.log(e);
      Alert.alert("Gagal", e?.message || "Tidak bisa mengambil foto.");
    } finally {
      setProcessingProof(false);
    }
  }

  function clearProof() {
    setProofLocal(null);
    setInvoiceDraft((p) =>
      p ? { ...p, proofDataUrl: null, proofMime: null, proofType: null } : p
    );
  }

  // ===================== BUILD DRAFT =====================
  async function buildDraftForMonths(
    s: Student,
    months: { key: string; label: string }[]
  ) {
    const now = new Date();
    const monthKeys = months.map((m) => m.key);
    const monthLabels = months.map((m) => m.label);

    const nominalTotal = Number(s.spp || 0) * monthKeys.length;

    // sum diskon untuk bulan yang dibayar
    let potonganTotal = 0;
    try {
      const snaps = await Promise.all(
        monthKeys.map((mk) =>
          getDoc(doc(db, "student_discounts", `${s.id}_${mk}`))
        )
      );
      potonganTotal = snaps.reduce((acc, snap) => {
        if (!snap.exists()) return acc;
        const v = Math.max(Number((snap.data() as any)?.nominal || 0), 0);
        return acc + v;
      }, 0);
    } catch (e) {
      console.log("load discounts error:", e);
      potonganTotal = 0;
    }

    const total = Math.max(nominalTotal - potonganTotal, 0);

    const paymentGroupId = `PAY-${branchId}-${Date.now()}-${s.id}`;

    const draft: InvoiceDraft = {
      paymentGroupId,
      studentId: s.id,
      studentName: s.name,
      studentType: s.type,
      branchId,
      branchName,
      monthKeys,
      monthLabels,
      nominal: nominalTotal,
      potongan: potonganTotal,
      total,
      metode: "Cash",
      status: "UNPAID",
      createdAtLocal: now,
      proofDataUrl: null,
      proofMime: null,
      proofType: null,
    };

    return draft;
  }

  // ===================== LOAD STATUS BULAN TERBAYAR =====================
  async function loadPaidMonthsForStudent(s: Student) {
    if (!branchId) return;

    try {
      const checks = await Promise.all(
        monthOptions.map(async (m) => {
          const invId = invoiceNoOf(branchId, m.key, s.id);
          const snap = await getDoc(doc(db, "invoices", invId));
          if (!snap.exists()) return [m.key, { paid: false }] as const;

          const data = snap.data() as any;
          const paid = String(data.status || "") === "PAID";
          const paidAt = data?.paidAt?.toDate ? data.paidAt.toDate() : null;

          return [
            m.key,
            { paid, paidAtText: paidAt ? formatTanggalJam(paidAt) : undefined },
          ] as const;
        })
      );

      const map: Record<string, { paid: boolean; paidAtText?: string }> = {};
      checks.forEach(([k, v]) => (map[k] = v));
      setPaidMonths(map);
      return map;
    } catch (e) {
      console.log("loadPaidMonths error:", e);
      setPaidMonths({});
      return {};
    }
  }

  // ✅ pilih default bulan: cari bulan ini kalau belum bayar, kalau sudah bayar pilih bulan unpaid terdekat setelahnya
  function pickDefaultMonthKey(paidMap: Record<string, { paid: boolean }>) {
    if (!paidMap?.[currentMonthKey]?.paid) return currentMonthKey;

    const order = monthOptions.map((m) => m.key);
    const startIdx = Math.max(order.indexOf(currentMonthKey), 0);
    for (let i = startIdx; i < order.length; i++) {
      const k = order[i];
      if (!paidMap?.[k]?.paid) return k;
    }
    // kalau semua sudah paid, fallback: bulan ini
    return currentMonthKey;
  }

  // ===================== OPEN INVOICE =====================
  async function openInvoice(s: Student) {
    if (!branchId) {
      Alert.alert("Cabang belum siap", "Tunggu data cabang admin ter-load.");
      return;
    }

    setSelected(s);
    setInvoiceOpen(true);
    setInvoiceLoading(true);
    setInvoiceDraft(null);
    setSpinBonusText("");
    setSpinDoneKeys([]);
    setProofLocal(null);
    setPaidMonths({});
    setMonthPickerOpen(false);

    // ✅ reset pre-spin
    setPreSpinLoading(false);
    setPreSpinDone(false);
    setPreSpinMonthKey(null);
    setPreSpinMonthLabel("");
    setPreSpinNominal(0);

    try {
      const paidMap = (await loadPaidMonthsForStudent(s)) || {};

      // ✅ default 1 bulan saja (biar tidak “keikut 2 bulan” seperti kasus Mei jadi 400)
      const defKey = pickDefaultMonthKey(paidMap);
      const defOpt =
        monthOptions.find((m) => m.key === defKey) || monthOptions[0];

      const draft = await buildDraftForMonths(s, [
        { key: defOpt.key, label: defOpt.label },
      ]);
      setInvoiceDraft(draft);
    } catch (e: any) {
      console.log(e);
      Alert.alert("Gagal", e?.message || "Tidak bisa memuat invoice.");
      setInvoiceOpen(false);
    } finally {
      setInvoiceLoading(false);
    }
  }

  function closeInvoiceModal() {
    setInvoiceOpen(false);
    setInvoiceDraft(null);
    setSelected(null);
    setSpinBonusText("");
    setSpinDoneKeys([]);
    setProofLocal(null);
    setPaidMonths({});
    setMonthPickerOpen(false);

    // ✅ reset pre-spin
    setPreSpinLoading(false);
    setPreSpinDone(false);
    setPreSpinMonthKey(null);
    setPreSpinMonthLabel("");
    setPreSpinNominal(0);
  }

  // ✅ toggle select bulan (dipakai di dropdown list)
  async function toggleMonthPick(key: string) {
    if (!selected || !invoiceDraft) return;
    if (invoiceDraft.status === "PAID") return;

    // ✅ kalau bulan ini sudah terbayar, jangan dipilih
    if (paidMonths?.[key]?.paid) {
      const label = monthOptions.find((m) => m.key === key)?.label || key;
      Alert.alert("Sudah Terbayar", `${label} sudah terbayar.`);
      return;
    }

    const exists = invoiceDraft.monthKeys.includes(key);
    let nextKeys = exists
      ? invoiceDraft.monthKeys.filter((k) => k !== key)
      : [...invoiceDraft.monthKeys, key];

    // minimal 1 bulan harus dipilih
    if (nextKeys.length === 0) nextKeys = [key];

    // sort sesuai urutan Jan–Dec
    const order = monthOptions.map((m) => m.key);
    nextKeys.sort((a, b) => order.indexOf(a) - order.indexOf(b));

    const nextMonths = nextKeys
      .map((k) => monthOptions.find((m) => m.key === k))
      .filter(Boolean)
      .map((m) => ({ key: (m as any).key, label: (m as any).label }));

    setInvoiceLoading(true);
    try {
      const rebuilt = await buildDraftForMonths(selected, nextMonths);
      setInvoiceDraft((p) =>
        p
          ? {
              ...rebuilt,
              metode: p.metode,
              proofDataUrl: p.proofDataUrl,
              proofMime: p.proofMime,
              proofType: p.proofType,
            }
          : rebuilt
      );
      setSpinBonusText("");
      setSpinDoneKeys([]);

      // ✅ jika bulan berubah, pre-spin reset (biar tidak nyasar)
      setPreSpinLoading(false);
      setPreSpinDone(false);
      setPreSpinMonthKey(null);
      setPreSpinMonthLabel("");
      setPreSpinNominal(0);
    } finally {
      setInvoiceLoading(false);
    }
  }

  // ===================== SPIN PRE-PAY (BARU) =====================
  async function spinBeforePayOnce() {
    if (!selected || !invoiceDraft) return;

    if (spinLoading) {
      Alert.alert("Tunggu", "Setting spin masih dimuat...");
      return;
    }

    // ✅ hanya sebelum tanggal
    if (!canSpinToday) {
      Alert.alert(
        "Spin Ditutup",
        `Spin hanya bisa dilakukan sebelum tanggal ${sebelumTanggal}.`
      );
      return;
    }

    // ✅ hanya saat belum bayar
    if (invoiceDraft.status === "PAID") {
      Alert.alert("Sudah Lunas", "Spin pre-pay hanya bisa sebelum pembayaran.");
      return;
    }

    // ✅ hanya 1x
    if (preSpinDone) return;

    const nextMk = spinNextMonthKey;
    if (!nextMk) {
      Alert.alert(
        "Pilih Bulan",
        "Pilih minimal 1 bulan yang mau dibayar dulu."
      );
      return;
    }

    const labelMonth = spinNextMonthLabel || nextMk;

    try {
      setPreSpinLoading(true);

      // ✅ voucher untuk bulan depan (dokumen diskon bulan depan)
      const bonusId = `${selected.id}_${nextMk}`;
      const refx = doc(db, "student_discounts", bonusId);

      // kalau sudah ada voucher bulan depan, jangan spin lagi
      const exists = await getDoc(refx);
      if (exists.exists()) {
        const ex = exists.data() as any;
        const nominalEx = Math.max(Number(ex?.nominal || 0), 0);

        setPreSpinDone(true);
        setPreSpinMonthKey(nextMk);
        setPreSpinMonthLabel(labelMonth);
        setPreSpinNominal(nominalEx);

        Alert.alert(
          "Info",
          `Kupon untuk ${labelMonth} sudah ada (${rupiah(nominalEx)}).`
        );
        return;
      }

      const picked = pickByWeight(hadiah);
      if (!picked) {
        Alert.alert("Gagal", "Data hadiah kosong / peluang 0 semua.");
        return;
      }

      const nominalBonus = Math.max(Number(picked.nominal || 0), 0);

      await runTransaction(db, async (trx) => {
        const snap = await trx.get(refx);
        if (snap.exists()) return;

        trx.set(refx, {
          studentId: selected.id,
          studentName: selected.name,
          branchId,
          branchName,
          monthKey: nextMk,
          label: picked.label,
          nominal: nominalBonus,
          createdAt: serverTimestamp(),

          // ✅ sumber: pre-pay
          source: "SPIN_PREPAY_FOR_NEXT_MONTH",
          sourcePaymentGroupId: invoiceDraft.paymentGroupId,
          dipakaiBulanDepan: true,
        });
      });

      setPreSpinDone(true);
      setPreSpinMonthKey(nextMk);
      setPreSpinMonthLabel(labelMonth);
      setPreSpinNominal(nominalBonus);

      // update sheet (voucherDidapat)
      try {
        const now2 = new Date();
        await pushPaymentToSheet({
          branchId,
          branchName,
          invoiceNo: invoiceDraft.paymentGroupId,
          tanggal: formatTanggalOnly(now2),
          jam: formatJamOnly(now2),
          studentName: invoiceDraft.studentName,
          jenisPembayaran: `SPP ${invoiceDraft.monthLabels.join(" + ")}`,
          metode: invoiceDraft.metode,
          nominal: invoiceDraft.total,
          voucherDipakai: invoiceDraft.potongan,
          voucherDidapat: nominalBonus,
          monthKey: invoiceDraft.monthKeys?.[0],
          createdAtIso: now2.toISOString(),
        });
      } catch (e) {
        console.log("push sheet (pre-spin) error:", e);
      }

      Alert.alert(
        "🎁 Spin Berhasil",
        `Kupon untuk ${labelMonth}\nHadiah: ${picked.label}\nPotongan: ${rupiah(
          nominalBonus
        )}`
      );
    } catch (e: any) {
      console.log(e);
      Alert.alert("Gagal", e?.message || "Spin gagal.");
    } finally {
      setPreSpinLoading(false);
    }
  }

  // ===================== PAY =====================
  async function confirmPay() {
    if (!invoiceDraft || !branchId || !selected) return;

    try {
      setPayLoading(true);

      const u = auth.currentUser;
      if (!u) {
        Alert.alert("Unauth", "Silakan login ulang.");
        return;
      }

      const hasProof = !!proofLocal?.dataUrl || !!invoiceDraft.proofDataUrl;
      if (invoiceDraft.metode === "Transfer" && !hasProof) {
        Alert.alert(
          "Bukti Transfer",
          "Untuk metode Transfer, wajib upload/foto bukti dulu."
        );
        return;
      }

      const proofDataUrl =
        proofLocal?.dataUrl || invoiceDraft.proofDataUrl || null;
      const proofMime = proofLocal?.mime || invoiceDraft.proofMime || null;
      const proofType =
        (proofLocal?.source as any) || invoiceDraft.proofType || null;

      const monthKeys = invoiceDraft.monthKeys;
      if (!monthKeys?.length) {
        Alert.alert("Pilih Bulan", "Minimal pilih 1 bulan untuk dibayar.");
        return;
      }

      await runTransaction(db, async (trx) => {
        // ---- 1) SEMUA READ DULU ----
        const invRefs = monthKeys.map((mk) => {
          const invId = invoiceNoOf(branchId, mk, selected.id);
          return { mk, invId, ref: doc(db, "invoices", invId) };
        });

        const discRefs = monthKeys.map((mk) => {
          const discId = `${selected.id}_${mk}`;
          return { mk, ref: doc(db, "student_discounts", discId) };
        });

        const invSnaps = await Promise.all(invRefs.map((x) => trx.get(x.ref)));
        const discSnaps = await Promise.all(
          discRefs.map((x) => trx.get(x.ref))
        );

        // cek sudah pernah bayar
        const alreadyPaid: string[] = [];
        invSnaps.forEach((snap, i) => {
          if (snap.exists()) alreadyPaid.push(invRefs[i].mk);
        });
        if (alreadyPaid.length) {
          throw new Error(
            `Bulan ini sudah pernah dibayar: ${alreadyPaid.join(", ")}`
          );
        }

        // potongan per bulan
        const discMap = new Map<string, number>();
        discSnaps.forEach((snap, i) => {
          const mk = discRefs[i].mk;
          const pot = snap.exists()
            ? Math.max(Number((snap.data() as any)?.nominal || 0), 0)
            : 0;
          discMap.set(mk, pot);
        });

        // ---- 2) WRITE ----
        for (let i = 0; i < invRefs.length; i++) {
          const { mk, invId, ref } = invRefs[i];
          const labelMk = invoiceDraft.monthLabels[i] || mk;

          const pot = discMap.get(mk) || 0;
          const nominal = Number(selected.spp || 0);
          const total = Math.max(nominal - pot, 0);

          const payload: any = {
            invoiceNo: invId,
            monthKey: mk,
            monthLabel: labelMk,

            studentId: selected.id,
            studentName: selected.name,
            studentType: selected.type,

            branchId,
            branchName,

            nominal,
            potongan: pot,
            total,

            metode: invoiceDraft.metode,
            status: "PAID",
            paidAt: serverTimestamp(),
            paidByUid: u.uid,
            createdAt: serverTimestamp(),

            paymentGroupId: invoiceDraft.paymentGroupId,
          };

          if (proofDataUrl) {
            payload.proofDataUrl = proofDataUrl;
            payload.proofMime = proofMime || "image/jpeg";
            payload.proofType = proofType || "upload";
            payload.proofUploadedAt = serverTimestamp();
          }

          trx.set(ref, payload);
          trx.set(doc(db, "payments", invId), payload);
        }

        trx.set(doc(db, "payment_groups", invoiceDraft.paymentGroupId), {
          paymentGroupId: invoiceDraft.paymentGroupId,
          studentId: selected.id,
          studentName: selected.name,
          branchId,
          branchName,
          monthKeys: invoiceDraft.monthKeys,
          monthLabels: invoiceDraft.monthLabels,
          nominal: invoiceDraft.nominal,
          potongan: invoiceDraft.potongan,
          total: invoiceDraft.total,
          metode: invoiceDraft.metode,
          status: "PAID",
          paidAt: serverTimestamp(),
          paidByUid: u.uid,
          createdAt: serverTimestamp(),
          proofDataUrl: proofDataUrl || null,
          proofMime: proofMime || null,
          proofType: proofType || null,
        });
      });

      setInvoiceDraft((p) =>
        p
          ? {
              ...p,
              status: "PAID",
              paidAtText: formatTanggalJam(new Date()),
              proofDataUrl: proofDataUrl || p.proofDataUrl || null,
              proofMime: proofMime || p.proofMime || "image/jpeg",
              proofType: proofType || p.proofType || null,
            }
          : p
      );

      // refresh badge status
      if (selected) {
        await loadPaidMonthsForStudent(selected);
      }

      // push sheet 1 baris (group)
      try {
        const now = new Date();
        await pushPaymentToSheet({
          branchId,
          branchName,
          invoiceNo: invoiceDraft.paymentGroupId,
          tanggal: formatTanggalOnly(now),
          jam: formatJamOnly(now),
          studentName: invoiceDraft.studentName,
          jenisPembayaran: `SPP ${invoiceDraft.monthLabels.join(" + ")}`,
          metode: invoiceDraft.metode,
          nominal: invoiceDraft.total,
          voucherDipakai: invoiceDraft.potongan,
          voucherDidapat: preSpinDone ? preSpinNominal : 0,
          monthKey: invoiceDraft.monthKeys?.[0],
          createdAtIso: now.toISOString(),
        });
      } catch (e) {
        console.log("push sheet (pay) error:", e);
      }

      Alert.alert("✅ Lunas", "Pembayaran berhasil disimpan.");
    } catch (e: any) {
      console.log(e);
      const msg = String(e?.message || "");
      if (
        msg.toLowerCase().includes("maximum") ||
        msg.toLowerCase().includes("size")
      ) {
        Alert.alert(
          "Gagal",
          "Ukuran bukti terlalu besar untuk Firestore. Coba pilih gambar lain / foto ulang."
        );
        return;
      }
      Alert.alert("Gagal", e?.message || "Pembayaran gagal.");
    } finally {
      setPayLoading(false);
    }
  }

  // padding aman
  const topPad = Math.max(insets.top + 8, 18);
  const bottomPad = Math.max(insets.bottom + 18, 28);

  const selectedMonthSummary = useMemo(() => {
    if (!invoiceDraft?.monthKeys?.length) return "-";
    if (invoiceDraft.monthLabels.length <= 2)
      return invoiceDraft.monthLabels.join(", ");
    return `${invoiceDraft.monthLabels[0]} + ${invoiceDraft.monthLabels[1]} (+${
      invoiceDraft.monthLabels.length - 2
    })`;
  }, [invoiceDraft?.monthKeys, invoiceDraft?.monthLabels]);

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={[THEME.bg1, THEME.bg2, THEME.bg3]}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: topPad, paddingBottom: bottomPad },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.brand}>Shining Sun 🎈</Text>
        <Text style={styles.title}>Bayar SPP</Text>
        <Text style={styles.subtitle}>
          Cabang:{" "}
          <Text style={{ fontWeight: "900", color: THEME.text }}>
            {branchName}
          </Text>
          {"\n"}Klik siswa → pilih bulan → invoice → (spin jika eligible) →
          bayar.
        </Text>

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color="#94A3B8" />
          <TextInput
            placeholder="Ketik nama siswa..."
            value={queryText}
            onChangeText={setQueryText}
            style={styles.searchInput}
            placeholderTextColor="#94A3B8"
          />
        </View>

        <View style={styles.card}>
          {showLoading ? (
            <View
              style={{ paddingVertical: 14, alignItems: "center", gap: 10 }}
            >
              <ActivityIndicator />
              <Text style={styles.note}>Memuat data siswa...</Text>
            </View>
          ) : !branchId ? (
            <Text style={[styles.note, { color: "#EF4444" }]}>
              Cabang admin belum diset. Set cabangId/branchId di users/{`{uid}`}{" "}
              dulu.
            </Text>
          ) : filtered.length === 0 ? (
            <Text style={styles.note}>Tidak ada siswa di cabang ini.</Text>
          ) : (
            filtered.map((s) => (
              <TouchableOpacity
                key={s.id}
                activeOpacity={0.9}
                onPress={() => openInvoice(s)}
                style={styles.row}
              >
                <View style={styles.avatar}>
                  <Ionicons name="person" size={16} color="#1E40AF" />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{s.name}</Text>
                  <Text style={styles.meta}>
                    {s.type === "Pertemuan"
                      ? `Pertemuan (${s.pertemuan || 8}x)`
                      : s.type}{" "}
                    • {rupiah(s.spp)}
                  </Text>
                </View>

                <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
              </TouchableOpacity>
            ))
          )}
        </View>

        <Text style={styles.note}>
          ℹ️ Jika bayar sebelum tanggal {sebelumTanggal}, maka tombol Spin
          terbuka dan hanya bisa 1x untuk potongan bulan setelah bulan terakhir
          yang dipilih (contoh bayar Jan–Mar ⇒ spin untuk April).
        </Text>

        <View style={{ height: Platform.OS === "ios" ? 8 : 16 }} />
      </ScrollView>

      {/* ===================== MODAL INVOICE ===================== */}
      <Modal
        visible={invoiceOpen}
        transparent
        animationType="fade"
        onRequestClose={closeInvoiceModal}
      >
        <View style={styles.backdrop}>
          <View style={styles.invoiceCard}>
            <View style={styles.invHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.invoiceTitle}>Invoice Pembayaran</Text>
              </View>

              {!!invoiceDraft && (
                <View
                  style={[
                    styles.statusPill,
                    invoiceDraft.status === "PAID"
                      ? styles.statusPaid
                      : styles.statusUnpaid,
                  ]}
                >
                  <Ionicons
                    name={
                      invoiceDraft.status === "PAID"
                        ? "checkmark-circle"
                        : "time"
                    }
                    size={14}
                    color={
                      invoiceDraft.status === "PAID" ? "#16A34A" : "#B45309"
                    }
                  />
                  <Text
                    style={[
                      styles.statusText,
                      invoiceDraft.status === "PAID"
                        ? { color: "#166534" }
                        : { color: "#92400E" },
                    ]}
                  >
                    {invoiceDraft.status === "PAID" ? "LUNAS" : "BELUM BAYAR"}
                  </Text>
                </View>
              )}

              <TouchableOpacity
                onPress={closeInvoiceModal}
                style={styles.xBtn}
                activeOpacity={0.9}
              >
                <Ionicons name="close" size={18} color="#0F172A" />
              </TouchableOpacity>
            </View>

            {invoiceLoading ? (
              <View
                style={{ paddingVertical: 16, alignItems: "center", gap: 10 }}
              >
                <ActivityIndicator />
                <Text style={styles.note}>Memuat invoice...</Text>
              </View>
            ) : !invoiceDraft ? (
              <Text style={[styles.note, { color: "#EF4444" }]}>
                Invoice tidak tersedia.
              </Text>
            ) : (
              <ScrollView
                style={{ maxHeight: 560 }}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 8 }}
              >
                {/* identitas */}
                <View style={styles.invIdentity}>
                  <View style={styles.invIdentityLeft}>
                    <View style={styles.invAvatar}>
                      <Ionicons name="person" size={16} color="#1E40AF" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.invName}>
                        {invoiceDraft.studentName}
                      </Text>
                      <Text style={styles.invMuted}>
                        {invoiceDraft.studentType} • {invoiceDraft.branchName}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* ✅ pilih bulan via DROPDOWN */}
                {invoiceDraft.status !== "PAID" && (
                  <View style={{ marginTop: 12 }}>
                    <Text style={styles.invSectionTitle}>
                      Pilih Bulan Dibayar
                    </Text>

                    <TouchableOpacity
                      activeOpacity={0.9}
                      style={styles.monthDropdownBtn}
                      onPress={() => setMonthPickerOpen(true)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.monthDropdownTitle}>
                          Dipilih:{" "}
                          <Text
                            style={{ color: THEME.text, fontWeight: "900" }}
                          >
                            {selectedMonthSummary}
                          </Text>
                        </Text>
                        <Text style={styles.monthDropdownHint}>
                          Tap untuk centang bulan • yang sudah dibayar tidak
                          bisa diklik
                        </Text>
                      </View>
                      <Ionicons name="chevron-down" size={18} color="#64748B" />
                    </TouchableOpacity>

                    {/* ✅ modal dropdown list bulan */}
                    <Modal
                      visible={monthPickerOpen}
                      transparent
                      animationType="fade"
                      onRequestClose={() => setMonthPickerOpen(false)}
                    >
                      <View style={styles.backdrop2}>
                        <View style={styles.monthPickerCard}>
                          <View style={styles.monthPickerHeader}>
                            <Text style={styles.monthPickerTitle}>
                              Pilih Bulan
                            </Text>
                            <TouchableOpacity
                              onPress={() => setMonthPickerOpen(false)}
                              style={styles.xBtn2}
                              activeOpacity={0.9}
                            >
                              <Ionicons
                                name="close"
                                size={18}
                                color="#0F172A"
                              />
                            </TouchableOpacity>
                          </View>

                          <ScrollView
                            showsVerticalScrollIndicator={false}
                            style={{ maxHeight: 420 }}
                          >
                            {monthOptions.map((m) => {
                              const active = invoiceDraft.monthKeys.includes(
                                m.key
                              );
                              const paid = !!paidMonths?.[m.key]?.paid;

                              return (
                                <TouchableOpacity
                                  key={m.key}
                                  activeOpacity={0.9}
                                  style={[
                                    styles.monthItem,
                                    active && styles.monthItemActive,
                                    paid && styles.monthItemPaid,
                                  ]}
                                  onPress={() => toggleMonthPick(m.key)}
                                  disabled={paid}
                                >
                                  <View
                                    style={{
                                      flexDirection: "row",
                                      alignItems: "center",
                                      gap: 10,
                                      flex: 1,
                                    }}
                                  >
                                    <Ionicons
                                      name={
                                        paid
                                          ? "checkmark-circle"
                                          : active
                                          ? "checkbox"
                                          : "square-outline"
                                      }
                                      size={18}
                                      color={
                                        paid
                                          ? "#16A34A"
                                          : active
                                          ? "#0F172A"
                                          : "#64748B"
                                      }
                                    />
                                    <View style={{ flex: 1 }}>
                                      <Text
                                        style={[
                                          styles.monthItemText,
                                          paid && { color: "#166534" },
                                          active &&
                                            !paid && { color: "#0F172A" },
                                        ]}
                                      >
                                        {m.label}
                                      </Text>
                                      {paidMonths?.[m.key]?.paidAtText ? (
                                        <Text style={styles.monthItemSub}>
                                          Lunas: {paidMonths[m.key].paidAtText}
                                        </Text>
                                      ) : paid ? (
                                        <Text style={styles.monthItemSub}>
                                          Sudah terbayar
                                        </Text>
                                      ) : (
                                        <Text style={styles.monthItemSub}>
                                          Belum dibayar
                                        </Text>
                                      )}
                                    </View>
                                  </View>

                                  {paid ? (
                                    <View style={styles.paidChip}>
                                      <Text style={styles.paidChipText}>
                                        TERBAYAR
                                      </Text>
                                    </View>
                                  ) : null}
                                </TouchableOpacity>
                              );
                            })}
                          </ScrollView>

                          <TouchableOpacity
                            onPress={() => setMonthPickerOpen(false)}
                            style={styles.monthPickerDone}
                            activeOpacity={0.9}
                          >
                            <Ionicons
                              name="checkmark-circle-outline"
                              size={18}
                              color="#fff"
                            />
                            <Text style={styles.monthPickerDoneText}>
                              Selesai
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </Modal>
                  </View>
                )}

                {/* meta */}
                <View style={styles.invMetaCard}>
                  <View style={styles.invMetaRow}>
                    <Text style={styles.invMetaK}>Bulan Tagihan</Text>
                    <Text style={styles.invMetaV}>
                      {invoiceDraft.monthLabels.join(", ")}
                    </Text>
                  </View>
                  <View style={styles.invMetaRow}>
                    <Text style={styles.invMetaK}>Tanggal / Jam</Text>
                    <Text style={styles.invMetaV}>
                      {invoiceDraft.status === "PAID"
                        ? invoiceDraft.paidAtText || "-"
                        : formatTanggalJam(invoiceDraft.createdAtLocal)}
                    </Text>
                  </View>
                </View>

                {/* rincian */}
                <View style={styles.invBox}>
                  <Text style={styles.invSectionTitle}>Rincian</Text>

                  <View style={styles.divDashed} />

                  <View style={styles.invRow}>
                    <Text style={styles.invK}>Nominal SPP</Text>
                    <Text style={styles.invV}>
                      {rupiah(invoiceDraft.nominal)}{" "}
                      <Text style={{ color: THEME.sub, fontWeight: "800" }}>
                        ({invoiceDraft.monthKeys.length} bulan)
                      </Text>
                    </Text>
                  </View>

                  <View style={styles.invRow}>
                    <Text style={styles.invK}>Potongan</Text>
                    <Text
                      style={[
                        styles.invV,
                        invoiceDraft.potongan > 0 && { color: "#16A34A" },
                      ]}
                    >
                      - {rupiah(invoiceDraft.potongan)}
                    </Text>
                  </View>

                  <View style={styles.divSolid} />

                  <View style={styles.invTotalRow}>
                    <Text style={styles.invTotalK}>TOTAL BAYAR</Text>
                    <Text style={styles.invTotalV}>
                      {rupiah(invoiceDraft.total)}
                    </Text>
                  </View>
                </View>

                {/* ✅ SPIN PRE-PAY (1x, sebelum upload bukti / sebelum bayar) */}
                {invoiceDraft.status !== "PAID" && (
                  <View style={{ marginTop: 12 }}>
                    <Text style={styles.invSectionTitle}>
                      Spin Potongan Bulan Depan
                    </Text>

                    <View style={styles.spinInfoBox}>
                      <Text style={styles.spinInfoText}>
                        Target kupon:{" "}
                        <Text style={{ fontWeight: "900", color: THEME.text }}>
                          {spinNextMonthLabel || "-"}
                        </Text>
                        {"\n"}
                        Status:{" "}
                        <Text style={{ fontWeight: "900", color: THEME.text }}>
                          {canSpinToday ? "BISA SPIN" : "TERKUNCI"}
                        </Text>
                      </Text>
                    </View>

                    <TouchableOpacity
                      activeOpacity={0.9}
                      style={[
                        styles.spinPreBtn,
                        (!canSpinToday ||
                          preSpinDone ||
                          preSpinLoading ||
                          !spinNextMonthKey ||
                          spinLoading) && { opacity: 0.45 },
                      ]}
                      onPress={spinBeforePayOnce}
                      disabled={
                        !canSpinToday ||
                        preSpinDone ||
                        preSpinLoading ||
                        !spinNextMonthKey ||
                        spinLoading
                      }
                    >
                      {preSpinLoading ? (
                        <ActivityIndicator />
                      ) : (
                        <>
                          <Ionicons
                            name="gift-outline"
                            size={18}
                            color="#0F172A"
                          />
                          <Text style={styles.spinPreText}>
                            {preSpinDone
                              ? `Kupon ${preSpinMonthLabel} didapat: ${rupiah(
                                  preSpinNominal
                                )}`
                              : "Spin Sekarang (1x)"}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>

                    <Text style={[styles.note, { marginTop: 8 }]}>
                      * Spin hanya 1x per pembayaran, untuk potongan bulan
                      setelah bulan terakhir yang kamu pilih.
                    </Text>
                  </View>
                )}

                {/* metode */}
                <View style={{ marginTop: 12 }}>
                  <Text style={styles.invSectionTitle}>Metode Pembayaran</Text>
                  <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
                    {(["Cash", "Transfer"] as const).map((m) => {
                      const active = invoiceDraft.metode === m;
                      return (
                        <TouchableOpacity
                          key={m}
                          activeOpacity={0.9}
                          onPress={() =>
                            setInvoiceDraft((p) =>
                              p ? { ...p, metode: m } : p
                            )
                          }
                          style={[
                            styles.methodPill,
                            active && styles.methodPillActive,
                          ]}
                          disabled={invoiceDraft.status === "PAID"}
                        >
                          <Ionicons
                            name={
                              m === "Cash"
                                ? "cash-outline"
                                : "swap-horizontal-outline"
                            }
                            size={16}
                            color={active ? "#0F172A" : "#64748B"}
                          />
                          <Text
                            style={[
                              styles.methodText,
                              active && { color: "#0F172A" },
                            ]}
                          >
                            {m}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* bukti pembayaran */}
                {invoiceDraft.status !== "PAID" && (
                  <View style={{ marginTop: 12 }}>
                    <Text style={styles.invSectionTitle}>Bukti Pembayaran</Text>

                    <View style={styles.proofBox}>
                      {proofLocal ? (
                        <View style={{ gap: 10 }}>
                          <Image
                            source={{
                              uri: proofLocal.dataUrl || proofLocal.uri,
                            }}
                            style={styles.proofImage}
                          />

                          {!!proofLocal.bytesApprox && (
                            <Text style={[styles.note, { marginTop: 0 }]}>
                              Ukuran bukti ~{" "}
                              {(proofLocal.bytesApprox / 1024).toFixed(0)} KB
                            </Text>
                          )}

                          <View style={{ flexDirection: "row", gap: 10 }}>
                            <TouchableOpacity
                              activeOpacity={0.9}
                              style={[styles.proofBtn, { flex: 1 }]}
                              onPress={pickFromGallery}
                              disabled={processingProof || payLoading}
                            >
                              <Ionicons
                                name="image-outline"
                                size={18}
                                color="#0F172A"
                              />
                              <Text style={styles.proofBtnText}>Ganti</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              activeOpacity={0.9}
                              style={[styles.proofBtn, { flex: 1 }]}
                              onPress={clearProof}
                              disabled={processingProof || payLoading}
                            >
                              <Ionicons
                                name="trash-outline"
                                size={18}
                                color="#EF4444"
                              />
                              <Text
                                style={[
                                  styles.proofBtnText,
                                  { color: "#EF4444" },
                                ]}
                              >
                                Hapus
                              </Text>
                            </TouchableOpacity>
                          </View>

                          {invoiceDraft.metode === "Transfer" && (
                            <Text style={[styles.note, { marginTop: 0 }]}>
                              * Transfer wajib upload/foto bukti.
                            </Text>
                          )}
                        </View>
                      ) : (
                        <View style={{ gap: 10 }}>
                          <View style={styles.proofEmpty}>
                            <Ionicons
                              name="cloud-upload-outline"
                              size={22}
                              color="#64748B"
                            />
                            <Text style={styles.proofEmptyText}>
                              Upload bukti atau foto langsung
                            </Text>
                          </View>

                          <View style={{ flexDirection: "row", gap: 10 }}>
                            <TouchableOpacity
                              activeOpacity={0.9}
                              style={[styles.proofBtn, { flex: 1 }]}
                              onPress={pickFromGallery}
                              disabled={processingProof || payLoading}
                            >
                              <Ionicons
                                name="image-outline"
                                size={18}
                                color="#0F172A"
                              />
                              <Text style={styles.proofBtnText}>Upload</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              activeOpacity={0.9}
                              style={[styles.proofBtn, { flex: 1 }]}
                              onPress={takePhoto}
                              disabled={processingProof || payLoading}
                            >
                              <Ionicons
                                name="camera-outline"
                                size={18}
                                color="#0F172A"
                              />
                              <Text style={styles.proofBtnText}>Foto</Text>
                            </TouchableOpacity>
                          </View>

                          {invoiceDraft.metode === "Transfer" && (
                            <Text style={[styles.note, { marginTop: 0 }]}>
                              * Transfer wajib upload/foto bukti.
                            </Text>
                          )}
                        </View>
                      )}
                    </View>
                  </View>
                )}

                {/* tombol bayar */}
                {invoiceDraft.status !== "PAID" ? (
                  <TouchableOpacity
                    activeOpacity={0.9}
                    style={[
                      styles.payNowBtn,
                      (payLoading || processingProof) && { opacity: 0.6 },
                    ]}
                    onPress={confirmPay}
                    disabled={payLoading || processingProof}
                  >
                    {payLoading || processingProof ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Ionicons
                          name="checkmark-circle-outline"
                          size={18}
                          color="#fff"
                        />
                        <Text style={styles.payNowText}>Bayar Sekarang</Text>
                      </>
                    )}
                  </TouchableOpacity>
                ) : (
                  <View style={styles.paidBox}>
                    <Ionicons name="checkmark-done" size={18} color="#16A34A" />
                    <Text style={styles.paidText}>
                      Pembayaran sudah LUNAS untuk:{" "}
                      {invoiceDraft.monthLabels.join(", ")}.
                    </Text>
                  </View>
                )}

                {!!spinBonusText && (
                  <Text
                    style={[styles.note, { marginTop: 10, color: "#0F172A" }]}
                  >
                    {spinBonusText}
                  </Text>
                )}

                <TouchableOpacity
                  onPress={closeInvoiceModal}
                  style={styles.closeBtn2}
                  activeOpacity={0.9}
                >
                  <Text style={styles.closeText2}>Tutup</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 18, paddingBottom: 28 },

  brand: { color: "#2563EB", fontWeight: "900", letterSpacing: 0.3 },
  title: { fontSize: 26, fontWeight: "900", marginTop: 6, color: THEME.text },
  subtitle: {
    color: THEME.sub,
    marginTop: 6,
    marginBottom: 12,
    fontWeight: "700",
    lineHeight: 20,
  },

  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingHorizontal: 12,
    height: 48,
    borderWidth: 1,
    borderColor: THEME.border,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: THEME.text,
    paddingVertical: 0,
  },

  card: {
    backgroundColor: THEME.card,
    borderRadius: 22,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.95)",
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 18,
    backgroundColor: "#fff",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.95)",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 16,
    backgroundColor: "rgba(219,234,254,0.95)",
    borderWidth: 1,
    borderColor: "rgba(191,219,254,1)",
    alignItems: "center",
    justifyContent: "center",
  },
  name: { fontWeight: "900", color: THEME.text, fontSize: 14 },
  meta: { marginTop: 2, color: THEME.sub, fontWeight: "700", fontSize: 12 },

  note: {
    marginTop: 12,
    textAlign: "center",
    color: "#94A3B8",
    fontWeight: "700",
    fontSize: 12,
    lineHeight: 18,
  },

  backdrop: {
    flex: 1,
    backgroundColor: "rgba(2,6,23,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },

  invoiceCard: {
    width: "100%",
    maxWidth: 430,
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.95)",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },

  invHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(226,232,240,0.95)",
  },
  invoiceTitle: { fontSize: 16, fontWeight: "900", color: THEME.text },

  xBtn: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: "rgba(226,232,240,0.85)",
    alignItems: "center",
    justifyContent: "center",
  },

  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusPaid: { backgroundColor: "#DCFCE7", borderColor: "#BBF7D0" },
  statusUnpaid: { backgroundColor: "#FEF9C3", borderColor: "#FDE68A" },
  statusText: { fontWeight: "900", fontSize: 11 },

  invIdentity: {
    marginTop: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.95)",
    padding: 12,
    backgroundColor: "rgba(248,250,252,1)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  invIdentityLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  invAvatar: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: "rgba(219,234,254,0.95)",
    borderWidth: 1,
    borderColor: "rgba(191,219,254,1)",
    alignItems: "center",
    justifyContent: "center",
  },
  invName: { fontWeight: "900", color: THEME.text, fontSize: 14 },
  invMuted: { marginTop: 2, fontWeight: "700", color: THEME.sub, fontSize: 12 },

  invMetaCard: {
    marginTop: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.95)",
    backgroundColor: "#fff",
    padding: 12,
  },
  invMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 6,
  },
  invMetaK: { color: THEME.sub, fontWeight: "800", fontSize: 12 },
  invMetaV: { color: THEME.text, fontWeight: "900", fontSize: 12 },

  invBox: {
    marginTop: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.95)",
    backgroundColor: "#fff",
    padding: 12,
  },
  invSectionTitle: { fontWeight: "900", color: THEME.text, fontSize: 13 },

  divDashed: {
    marginTop: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: THEME.border,
    borderStyle: "dashed",
  },
  divSolid: {
    height: 1,
    backgroundColor: THEME.border,
    marginTop: 12,
    marginBottom: 10,
  },

  invRow: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  invK: { color: THEME.sub, fontWeight: "800", fontSize: 12 },
  invV: { color: THEME.text, fontWeight: "900", fontSize: 12 },

  invTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(14,165,233,0.08)",
    borderWidth: 1,
    borderColor: "rgba(14,165,233,0.22)",
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 14,
  },
  invTotalK: { color: THEME.text, fontWeight: "900", fontSize: 13 },
  invTotalV: { color: THEME.text, fontWeight: "900", fontSize: 16 },

  methodPill: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.95)",
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    flexDirection: "row",
    gap: 8,
  },
  methodPillActive: {
    backgroundColor: "#DBEAFE",
    borderColor: "#BFDBFE",
  },
  methodText: { fontWeight: "900", color: THEME.sub },

  // ✅ dropdown bulan
  monthDropdownBtn: {
    marginTop: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.95)",
    padding: 12,
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  monthDropdownTitle: { fontWeight: "900", color: THEME.sub, fontSize: 12 },
  monthDropdownHint: {
    marginTop: 4,
    color: "#94A3B8",
    fontWeight: "700",
    fontSize: 11,
  },

  backdrop2: {
    flex: 1,
    backgroundColor: "rgba(2,6,23,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  monthPickerCard: {
    width: "100%",
    maxWidth: 430,
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.95)",
  },
  monthPickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(226,232,240,0.95)",
  },
  monthPickerTitle: { fontSize: 15, fontWeight: "900", color: THEME.text },
  xBtn2: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: "rgba(226,232,240,0.85)",
    alignItems: "center",
    justifyContent: "center",
  },
  monthItem: {
    marginTop: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.95)",
    padding: 12,
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  monthItemActive: {
    backgroundColor: "#DBEAFE",
    borderColor: "#BFDBFE",
  },
  monthItemPaid: {
    backgroundColor: "#F0FDF4",
    borderColor: "#BBF7D0",
    opacity: 0.85,
  },
  monthItemText: { fontWeight: "900", color: THEME.sub, fontSize: 13 },
  monthItemSub: {
    marginTop: 4,
    color: "#94A3B8",
    fontWeight: "700",
    fontSize: 11,
  },
  paidChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#DCFCE7",
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  paidChipText: { fontSize: 10, fontWeight: "900", color: "#166534" },
  monthPickerDone: {
    marginTop: 12,
    backgroundColor: THEME.primary,
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  monthPickerDoneText: { color: "#fff", fontWeight: "900", fontSize: 15 },

  proofBox: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.95)",
    borderRadius: 18,
    padding: 12,
    backgroundColor: "#fff",
  },
  proofEmpty: {
    height: 84,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.95)",
    backgroundColor: "rgba(248,250,252,1)",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  proofEmptyText: { color: THEME.sub, fontWeight: "700", fontSize: 12 },
  proofBtn: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.95)",
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    flexDirection: "row",
    gap: 8,
  },
  proofBtnText: { fontWeight: "900", color: THEME.text },
  proofImage: {
    width: "100%",
    height: 220,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.95)",
    backgroundColor: "#F1F5F9",
  },

  payNowBtn: {
    marginTop: 12,
    backgroundColor: THEME.primary,
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  payNowText: { color: "#fff", fontWeight: "900", fontSize: 15 },

  paidBox: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#BBF7D0",
    backgroundColor: "#DCFCE7",
  },
  paidText: { fontWeight: "900", color: "#0F172A", flex: 1 },

  // ✅ pre-spin ui
  spinInfoBox: {
    marginTop: 8,
    backgroundColor: "rgba(219,234,254,0.55)",
    borderWidth: 1,
    borderColor: "rgba(191,219,254,1)",
    padding: 10,
    borderRadius: 14,
  },
  spinInfoText: {
    color: THEME.text,
    fontWeight: "700",
    fontSize: 12,
    lineHeight: 18,
  },
  spinPreBtn: {
    marginTop: 10,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.95)",
    backgroundColor: "#fff",
  },
  spinPreText: { fontWeight: "900", color: THEME.text },

  closeBtn2: { marginTop: 10, alignItems: "center" },
  closeText2: { fontWeight: "900", color: "#EF4444" },
});

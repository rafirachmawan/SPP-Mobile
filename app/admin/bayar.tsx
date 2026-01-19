// FILE: app/admin/bayar.tsx
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

// ✅ Safe Area
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ✅ Image Picker (Expo)
import * as ImagePicker from "expo-image-picker";

// ✅ Compress/Resize + Base64
import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";

// ✅ Firebase
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { auth, db } from "../../firebase";

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
  active: boolean; // ✅ FIX: baca status aktif
};

type Hadiah = { id: string; label: string; nominal: number; peluang: number };

type InvoiceDraft = {
  paymentGroupId: string;
  spinByMonth: Record<string, number>; // ⬅️ POTONGAN SPIN MURNI

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

  // ✅ detail potongan per bulan
  potonganByMonth: Record<string, number>;

  metode: "Cash" | "Transfer";

  status: "UNPAID" | "PAID";
  createdAtLocal: Date;
  paidAtText?: string;

  proofDataUrl?: string | null;
  proofMime?: string | null;
  proofType?: "camera" | "gallery" | "upload" | null;
};

type ProofLocal = {
  uri: string;
  dataUrl: string;
  mime: string;
  source: "camera" | "gallery";
  bytesApprox?: number;
};

function nextMonthKey(mk: string) {
  const [y, m] = mk.split("-").map(Number);
  const d = new Date(y, m, 1); // month auto +1
  return monthKeyOf(d);
}

function rupiah(n: number) {
  return "Rp " + Number(n || 0).toLocaleString("id-ID");
}

function formatRupiahInput(value: string) {
  const numeric = value.replace(/[^\d]/g, "");
  const numberValue = Number(numeric || 0);

  const formatted =
    numberValue === 0 ? "" : "Rp " + numberValue.toLocaleString("id-ID");

  return {
    raw: numberValue,
    formatted,
  };
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
    d.getMonth() + 1,
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

function buildPotonganByMonth(
  draft: InvoiceDraft,
  manual: Record<string, number>,
) {
  let potonganTotal = 0;
  const potonganByMonth: Record<string, number> = {};

  for (const mk of draft.monthKeys) {
    // 🔹 spin dari draft awal (hasil load Firestore)
    const spinPot = Math.max(Number(draft.potonganByMonth?.[mk] || 0), 0);

    // 🔹 manual dari input admin
    const manualPot = Math.max(Number(manual?.[mk] || 0), 0);

    const totalPot = spinPot + manualPot;

    potonganByMonth[mk] = totalPot;
    potonganTotal += totalPot;
  }

  return {
    potonganByMonth,
    potonganTotal,
  };
}

/**
 * ✅ Push pembayaran ke Google Sheet via Apps Script WebApp
 */
async function pushPaymentToSheet(payload: {
  voucherSpinDetail?: string;
  invoiceNo: string;
  branchId?: string;
  branchName: string;

  tanggal: string;
  jam: string;

  studentName?: string;
  namaSiswa?: string;

  jenisPembayaran: string;
  metode: "Cash" | "Transfer";

  nominalSebelumVoucher: number;
  voucherSpin: number;
  voucherManual: number;
  totalVoucher: number;
  totalDibayar: number;

  monthKey?: string;
  createdAtIso?: string;
}) {
  try {
    const res = await fetch(
      "https://script.google.com/macros/s/AKfycbytbmr5VMMIm2qNKqGYI4pBm7Qh7PU5pEKLIXIUwyyo9sKcJv4MPxInMN2CrZWjWK9ViQ/exec",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );

    const raw = await res.text();
    console.log("push sheet raw:", raw);
    return true;
  } catch (e) {
    console.log("push sheet error:", e);
    return false;
  }
} // ⬅️ INI WAJIB ADA

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
  opts?: { maxWidth?: number; compress?: number },
) {
  const maxWidth = opts?.maxWidth ?? 720;
  const compress = opts?.compress ?? 0.5;

  const manip = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: maxWidth } }],
    { compress, format: ImageManipulator.SaveFormat.JPEG },
  );

  const b64 = await FileSystem.readAsStringAsync(manip.uri, {
    encoding: "base64" as any,
  });

  const bytesApprox = Math.floor((b64.length * 3) / 4);
  const dataUrl = `data:image/jpeg;base64,${b64}`;

  return { dataUrl, uri: manip.uri, mime: "image/jpeg", bytesApprox };
}

function InvoiceRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <View style={styles.invRowSimple}>
      <Text style={styles.invLabel}>{label}</Text>
      <Text style={[styles.invValue, strong && { fontSize: 16 }]}>{value}</Text>
    </View>
  );
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
              : [{ id: "H1", label: "Zonk", nominal: 0, peluang: 100 }],
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
            "Akun admin ini belum punya cabangId/branchId. Set dulu dari SUPERADMIN.",
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
            String(data.branchName || data.cabangName || "-") || "-",
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
      orderBy("createdAt", "desc"),
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
            active: data.active !== false, // ✅ FIX
          };
        });

        // ✅ FIX: hanya tampilkan siswa aktif
        const activeRows = rows.filter((x) => x.active !== false);

        setStudents(activeRows);
        setStudentLoading(false);
      },
      (err) => {
        console.log(err);
        setStudentLoading(false);
        Alert.alert("Gagal", "Tidak bisa mengambil data siswa.");
      },
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

  // ✅ potongan manual (voucher tanpa spin)
  const [manualDiscounts, setManualDiscounts] = useState<
    Record<string, number>
  >({});

  const [manualDiscountInput, setManualDiscountInput] = useState<
    Record<string, string>
  >({});

  const [payLoading, setPayLoading] = useState(false);

  // ✅ bukti pembayaran
  const [proofLocal, setProofLocal] = useState<ProofLocal | null>(null);
  const [processingProof, setProcessingProof] = useState(false);

  // ✅ status bulan terbayar
  const [paidMonths, setPaidMonths] = useState<
    Record<string, { paid: boolean; paidAtText?: string }>
  >({});

  // ✅ dropdown modal bulan
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);

  const showLoading = profileLoading || studentLoading;

  // ===================== MULTI SPIN (STEP-BY-STEP) =====================
  const [multiSpinLoading, setMultiSpinLoading] = useState(false);

  // doneMap: monthKey -> nominal
  const [multiSpinDoneMap, setMultiSpinDoneMap] = useState<
    Record<string, number | null>
  >({});
  const [lastSpinAwardTotal, setLastSpinAwardTotal] = useState(0);

  function monthIndexOfKey(mk: string) {
    const order = monthOptions.map((m) => m.key);
    return order.indexOf(mk);
  }

  /**
   * ✅ FIX: Eligible spin = semua bulan yang dipilih KECUALI bulan pertama (paling awal) di selection.
   * Contoh: Jan+Feb+Mar => eligible: Feb, Mar (2x spin)
   */
  function getEligibleSpinMonths(
    paidKeys: string[],
    paidMonthsMap: Record<string, { paid: boolean }>,
  ) {
    const order = monthOptions.map((m) => m.key);
    const result = new Set<string>();

    for (const mk of paidKeys) {
      const next = nextMonthKey(mk);

      // valid month
      if (!order.includes(next)) continue;

      // bulan spin BELUM dibayar
      if (paidMonthsMap?.[next]?.paid) continue;

      result.add(next);
    }

    return Array.from(result).sort(
      (a, b) => order.indexOf(a) - order.indexOf(b),
    );
  }

  async function ensurePerms() {
    const lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (lib.status !== "granted") {
      Alert.alert(
        "Izin dibutuhkan",
        "Izinkan akses galeri untuk upload bukti.",
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
          "Ukuran bukti masih besar. Kalau nanti gagal simpan, coba foto ulang / pilih gambar lebih kecil.",
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
          "Ukuran bukti masih besar. Kalau nanti gagal simpan, coba foto ulang / pilih gambar lebih kecil.",
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
      p ? { ...p, proofDataUrl: null, proofMime: null, proofType: null } : p,
    );
  }
  const spinByMonth: Record<string, number> = {};

  // ===================== BUILD DRAFT =====================
  async function buildDraftForMonths(
    s: Student,
    months: { key: string; label: string }[],
    keepPaymentGroupId?: string,
  ) {
    const now = new Date();
    const monthKeys = months.map((m) => m.key);
    const monthLabels = months.map((m) => m.label);

    const nominalTotal = Number(s.spp || 0) * monthKeys.length;

    // ✅ potongan per bulan + total
    let potonganTotal = 0;
    const potonganByMonth: Record<string, number> = {};
    try {
      const spinSnaps = await Promise.all(
        monthKeys.map((mk) =>
          getDoc(doc(db, "student_discounts", `${s.id}_${mk}`)),
        ),
      );

      const manualSnaps = await Promise.all(
        monthKeys.map((mk) =>
          getDoc(doc(db, "manual_discounts", `${s.id}_${mk}`)),
        ),
      );

      spinSnaps.forEach((spinSnap, idx) => {
        const mk = monthKeys[idx];

        const spinPot = spinSnap.exists()
          ? Math.max(Number((spinSnap.data() as any)?.nominal || 0), 0)
          : 0;

        const manualPot = manualSnaps[idx]?.exists()
          ? Math.max(Number((manualSnaps[idx].data() as any)?.nominal || 0), 0)
          : 0;

        const totalPot = spinPot + manualPot; // ✅ GABUNG

        potonganByMonth[mk] = totalPot; // ✅ FIX
        spinByMonth[mk] = spinPot; // tetap simpan spin
        potonganTotal += totalPot; // ✅ FIX
      });
    } catch (e) {
      console.log("❌ GAGAL LOAD DISCOUNT:", e);

      Alert.alert(
        "Potongan tidak bisa dimuat",
        "Gagal mengambil data voucher. Cek koneksi atau izin Firestore.",
      );

      throw e; // ⬅️ HENTIKAN PROSES
    }

    const total = Math.max(nominalTotal - potonganTotal, 0);

    // ✅ FIX: paymentGroupId jangan berubah saat rebuild (biar konsisten)
    const paymentGroupId =
      keepPaymentGroupId || `PAY-${branchId}-${Date.now()}-${s.id}`;

    const draft: InvoiceDraft = {
      potonganByMonth, // hanya spin
      spinByMonth, // ⬅️ sumber murni
      potongan: potonganTotal,
      total,
      paymentGroupId,
      studentId: s.id,
      studentName: s.name,
      studentType: s.type,
      branchId,
      branchName,
      monthKeys,
      monthLabels,
      nominal: nominalTotal,
      metode: "Cash",
      status: "UNPAID",
      createdAtLocal: now,
      proofDataUrl: null,
      proofMime: null,
      proofType: null,
    };

    return draft;
  }

  function applyManualDiscountToDraft(
    draft: InvoiceDraft,
    manual: Record<string, number>,
  ) {
    let potonganTotal = 0;
    const potonganByMonth: Record<string, number> = {};

    for (const mk of draft.monthKeys) {
      const spinPot = Math.max(Number(draft.spinByMonth?.[mk] || 0), 0);
      const manualPot = Math.max(Number(manual?.[mk] || 0), 0);

      const totalPot = spinPot + manualPot;

      potonganByMonth[mk] = totalPot;
      potonganTotal += totalPot;
    }

    const total = Math.max(draft.nominal - potonganTotal, 0);

    return {
      ...draft,
      potonganByMonth,
      potongan: potonganTotal,
      total,
    };
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
        }),
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
    return currentMonthKey;
  }

  // ===================== OPEN INVOICE =====================
  async function openInvoice(s: Student) {
    if (!branchId) {
      Alert.alert("Cabang belum siap", "Tunggu data cabang admin ter-load.");
      return;
    }

    // ✅ FIX: double-check ke Firestore biar siswa nonaktif tidak bisa buka invoice
    try {
      const sSnap = await getDoc(doc(db, "students", s.id));
      if (!sSnap.exists()) {
        Alert.alert("Gagal", "Data siswa tidak ditemukan.");
        return;
      }
      const sd = sSnap.data() as any;
      if (sd.active === false) {
        Alert.alert("Ditolak", "Siswa ini NONAKTIF. Tidak bisa bayar SPP.");
        return;
      }
    } catch (e) {
      console.log("check active (openInvoice) error:", e);
      // kalau gagal cek, tetap lanjut sesuai logika lama (biar tidak merusak flow)
    }

    setSelected(s);
    setInvoiceOpen(true);
    setInvoiceLoading(true);
    setInvoiceDraft(null);
    setProofLocal(null);
    setPaidMonths({});
    setMonthPickerOpen(false);

    // ✅ reset multi spin state
    setMultiSpinLoading(false);
    setMultiSpinDoneMap({});
    setLastSpinAwardTotal(0);

    try {
      const paidMap = (await loadPaidMonthsForStudent(s)) || {};

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
    setManualDiscountInput({});
    setManualDiscounts({});

    setInvoiceOpen(false);
    setInvoiceDraft(null);
    setSelected(null);
    setProofLocal(null);
    setPaidMonths({});
    setMonthPickerOpen(false);

    setMultiSpinLoading(false);
    setMultiSpinDoneMap({});
    setLastSpinAwardTotal(0);
  }

  // ✅ toggle select bulan (dipakai di dropdown list)
  async function toggleMonthPick(key: string) {
    if (!selected || !invoiceDraft) return;
    if (invoiceDraft.status === "PAID") return;

    if (paidMonths?.[key]?.paid) {
      const label = monthOptions.find((m) => m.key === key)?.label || key;
      Alert.alert("Sudah Terbayar", `${label} sudah terbayar.`);
      return;
    }

    const exists = invoiceDraft.monthKeys.includes(key);
    let nextKeys = exists
      ? invoiceDraft.monthKeys.filter((k) => k !== key)
      : [...invoiceDraft.monthKeys, key];
    if (nextKeys.length === 0) nextKeys = [key];

    const order = monthOptions.map((m) => m.key);
    nextKeys.sort((a, b) => order.indexOf(a) - order.indexOf(b));

    const nextMonths = nextKeys
      .map((k) => monthOptions.find((m) => m.key === k))
      .filter(Boolean)
      .map((m) => ({ key: (m as any).key, label: (m as any).label }));

    setInvoiceLoading(true);
    try {
      // ✅ keep paymentGroupId saat rebuild
      const rebuilt = await buildDraftForMonths(
        selected,
        nextMonths,
        invoiceDraft.paymentGroupId,
      );
      setInvoiceDraft((p) =>
        p
          ? {
              ...rebuilt,
              metode: p.metode,
              proofDataUrl: p.proofDataUrl,
              proofMime: p.proofMime,
              proofType: p.proofType,
            }
          : rebuilt,
      );

      // ✅ reset multi spin ketika pilihan bulan berubah (biar tidak nyasar)
      setMultiSpinLoading(false);
      setMultiSpinDoneMap({});
      setLastSpinAwardTotal(0);
    } finally {
      setInvoiceLoading(false);
    }
  }

  // ===================== SPIN STEP-BY-STEP (FIX: auto hitung pending tanpa queue/cursor) =====================
  async function spinNext() {
    if (!selected || !invoiceDraft) return;

    if (spinLoading) {
      Alert.alert("Tunggu", "Setting spin masih dimuat...");
      return;
    }

    if (!canSpinToday) {
      Alert.alert(
        "Spin Ditutup",
        `Spin hanya bisa dilakukan sebelum tanggal ${sebelumTanggal}.`,
      );
      return;
    }

    if (invoiceDraft.status === "PAID") {
      Alert.alert("Sudah Lunas", "Spin hanya bisa sebelum pembayaran.");
      return;
    }

    const eligible = getEligibleSpinMonths(invoiceDraft.monthKeys, paidMonths);

    const pending = eligible.filter((mk) => multiSpinDoneMap[mk] == null);

    const currentMk = pending[0];
    if (!currentMk) {
      Alert.alert("Selesai", "Semua bulan yang eligible sudah di-spin.");
      return;
    }

    try {
      setMultiSpinLoading(true);

      const discId = `${selected.id}_${currentMk}`;
      const refx = doc(db, "student_discounts", discId);

      // kalau sudah ada voucher, catat lalu selesai step ini (tanpa mengurangi jatah)
      const exists = await getDoc(refx);
      if (exists.exists()) {
        const ex = exists.data() as any;
        const nominalEx = Math.max(Number(ex?.nominal || 0), 0);

        setMultiSpinDoneMap((p) => ({ ...p, [currentMk]: nominalEx }));
        setLastSpinAwardTotal((p) => p + nominalEx);

        // rebuild invoice agar potongan langsung kepotong
        setInvoiceLoading(true);
        const nextMonths = invoiceDraft.monthKeys
          .map((k) => monthOptions.find((m) => m.key === k))
          .filter(Boolean)
          .map((m: any) => ({ key: m.key, label: m.label }));

        const rebuilt = await buildDraftForMonths(
          selected,
          nextMonths,
          invoiceDraft.paymentGroupId,
        );
        setInvoiceDraft((p) =>
          p
            ? {
                ...rebuilt,
                metode: p.metode,
                proofDataUrl: p.proofDataUrl,
                proofMime: p.proofMime,
                proofType: p.proofType,
              }
            : rebuilt,
        );
        setInvoiceLoading(false);
        return;
      }

      const picked = pickByWeight(hadiah);
      if (!picked) throw new Error("Hadiah spin kosong.");

      const nominalBonus = Math.max(Number(picked.nominal || 0), 0);

      await runTransaction(db, async (trx) => {
        const snap = await trx.get(refx);
        if (snap.exists()) return;

        trx.set(refx, {
          studentId: selected.id,
          studentName: selected.name,
          branchId,
          branchName,
          monthKey: currentMk,
          label: picked.label,
          nominal: nominalBonus,
          createdAt: serverTimestamp(),
          source: "SPIN_STEP_BY_STEP",
          sourcePaymentGroupId: invoiceDraft.paymentGroupId,
          // ✅ dipakai untuk invoice bulan itu (bulan yang di-spin)
          dipakaiBulanDepan: false,
        });
      });

      setMultiSpinDoneMap((p) => ({ ...p, [currentMk]: nominalBonus }));
      setLastSpinAwardTotal((p) => p + nominalBonus);

      const lab =
        monthOptions.find((m) => m.key === currentMk)?.label || currentMk;
      Alert.alert(
        "🎁 Spin Berhasil",
        `${lab}\n${picked.label} (${rupiah(nominalBonus)})`,
      );

      // ✅ rebuild invoice agar potongan langsung masuk rincian (Feb & Mar kelihatan)
      setInvoiceLoading(true);
      const nextMonths = invoiceDraft.monthKeys
        .map((k) => monthOptions.find((m) => m.key === k))
        .filter(Boolean)
        .map((m: any) => ({ key: m.key, label: m.label }));

      const rebuilt = await buildDraftForMonths(
        selected,
        nextMonths,
        invoiceDraft.paymentGroupId,
      );
      setInvoiceDraft((p) =>
        p
          ? {
              ...rebuilt,
              metode: p.metode,
              proofDataUrl: p.proofDataUrl,
              proofMime: p.proofMime,
              proofType: p.proofType,
            }
          : rebuilt,
      );
      setInvoiceLoading(false);
    } catch (e: any) {
      console.log(e);
      Alert.alert("Gagal", e?.message || "Spin gagal.");
    } finally {
      setMultiSpinLoading(false);
      setInvoiceLoading(false);
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

      // ✅ FIX: FINAL CHECK siswa masih aktif saat bayar
      try {
        const sSnap = await getDoc(doc(db, "students", selected.id));
        if (!sSnap.exists()) {
          Alert.alert("Gagal", "Data siswa tidak ditemukan.");
          return;
        }
        const sd = sSnap.data() as any;
        if (sd.active === false) {
          Alert.alert("Ditolak", "Siswa ini NONAKTIF. Pembayaran dibatalkan.");
          return;
        }
      } catch (e) {
        console.log("check active (confirmPay) error:", e);
        // jika gagal cek, lanjut saja sesuai logika lama
      }

      const hasProof = !!proofLocal?.dataUrl || !!invoiceDraft.proofDataUrl;
      if (invoiceDraft.metode === "Transfer" && !hasProof) {
        Alert.alert(
          "Bukti Transfer",
          "Untuk metode Transfer, wajib upload/foto bukti dulu.",
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
          discRefs.map((x) => trx.get(x.ref)),
        );

        const alreadyPaid: string[] = [];
        invSnaps.forEach((snap, i) => {
          if (snap.exists()) alreadyPaid.push(invRefs[i].mk);
        });
        if (alreadyPaid.length) {
          throw new Error(
            `Bulan ini sudah pernah dibayar: ${alreadyPaid.join(", ")}`,
          );
        }

        const discMap = new Map<string, number>();
        discSnaps.forEach((snap, i) => {
          const mk = discRefs[i].mk;
          const pot = snap.exists()
            ? Math.max(Number((snap.data() as any)?.nominal || 0), 0)
            : 0;
          discMap.set(mk, pot);
        });

        // ✅ simpan potongan manual (voucher)
        for (const mk of monthKeys) {
          const manualPot = manualDiscounts?.[mk];
          if (manualPot && manualPot > 0) {
            const ref = doc(db, "manual_discounts", `${selected.id}_${mk}`);

            trx.set(ref, {
              studentId: selected.id,
              studentName: selected.name,
              branchId,
              branchName,
              monthKey: mk,
              nominal: manualPot,
              createdAt: serverTimestamp(),
              createdByUid: u.uid,
              source: "MANUAL",
              sourcePaymentGroupId: invoiceDraft.paymentGroupId,
            });
          }
        }

        for (let i = 0; i < invRefs.length; i++) {
          const { mk, invId, ref } = invRefs[i];
          const labelMk = invoiceDraft.monthLabels[i] || mk;

          const pot = Math.max(
            Number(invoiceDraft.potonganByMonth?.[mk] || 0),
            0,
          );

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
          : p,
      );

      if (selected) {
        await loadPaidMonthsForStudent(selected);
      }
      // ===================== HITUNG UNTUK SPREADSHEET =====================
      const nominalSebelumVoucher = invoiceDraft.nominal;

      // total spin (yang didapat dari spin)
      const voucherSpin = lastSpinAwardTotal;

      // ✅ DETAIL VOUCHER SPIN PER BULAN (UNTUK ADMIN)
      const voucherSpinDetail = Object.entries(multiSpinDoneMap)
        .filter(([_, v]) => v && v > 0)
        .map(([mk, v]) => {
          const label = monthOptions.find((m) => m.key === mk)?.label || mk;
          return `${label}: ${v}`;
        })
        .join(", ");

      // total voucher manual
      const voucherManual = Object.values(manualDiscounts || {}).reduce(
        (a, b) => a + Number(b || 0),
        0,
      );

      // total voucher
      const totalVoucher = voucherSpin + voucherManual;

      // total yang benar-benar dibayar
      const totalDibayar = invoiceDraft.total;

      try {
        const now = new Date();
        await pushPaymentToSheet({
          invoiceNo: invoiceDraft.paymentGroupId, // OK
          branchId,
          branchName,

          tanggal: formatTanggalOnly(now),
          jam: formatJamOnly(now),
          studentName: invoiceDraft.studentName,
          jenisPembayaran: `SPP ${invoiceDraft.monthLabels.join(" + ")}`,
          metode: invoiceDraft.metode,

          nominalSebelumVoucher,
          voucherSpin,
          voucherManual,
          totalVoucher,
          totalDibayar,

          voucherSpinDetail, // ✅ BARU (INI PENTING)

          monthKey: invoiceDraft.monthKeys?.[0] || "",
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
          "Ukuran bukti terlalu besar untuk Firestore. Coba pilih gambar lain / foto ulang.",
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
          {/* {"\n"}Klik siswa → pilih bulan → invoice → (spin jika eligible) →
          bayar. */}
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
          ℹ️ Jika bayar sebelum tanggal {sebelumTanggal}, tombol Spin terbuka.
          {/* {"\n"}✅ Spin sekarang{" "}
          <Text style={{ fontWeight: "900" }}>mengikuti pilihan bulan</Text>:
          jumlah spin = (bulan dipilih - 1).{"\n"}Contoh: pilih Jan+Feb+Mar ⇒
          Spin 2x: untuk Feb lalu Mar. */}
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
                                m.key,
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
                <View style={styles.invSummaryCard}>
                  <InvoiceRow
                    label="Nama Siswa"
                    value={invoiceDraft.studentName}
                  />
                  <InvoiceRow label="Cabang" value={invoiceDraft.branchName} />
                  <InvoiceRow
                    label="Periode"
                    value={invoiceDraft.monthLabels.join(", ")}
                  />
                  <InvoiceRow
                    label="Tanggal"
                    value={
                      invoiceDraft.status === "PAID"
                        ? invoiceDraft.paidAtText || "-"
                        : formatTanggalJam(invoiceDraft.createdAtLocal)
                    }
                  />

                  <View style={styles.divSolid} />

                  <InvoiceRow
                    label="Total Tagihan"
                    value={rupiah(invoiceDraft.total)}
                    strong
                  />
                </View>

                {/* ✅ SPIN STEP-BY-STEP */}
                {invoiceDraft.status !== "PAID" && (
                  <View style={{ marginTop: 12 }}>
                    <Text style={styles.invSectionTitle}>
                      Spin Potongan (Untuk Bulan Setelah Bulan Pertama)
                    </Text>

                    {(() => {
                      const eligible = getEligibleSpinMonths(
                        invoiceDraft.monthKeys,
                        paidMonths,
                      );

                      const pending = eligible.filter(
                        (mk) => multiSpinDoneMap[mk] == null,
                      );

                      const stepNow = eligible.length - pending.length + 1;
                      const stepMax = eligible.length;

                      return (
                        <>
                          <View style={styles.spinInfoBox}>
                            <Text style={styles.spinInfoText}>
                              Status:{" "}
                              <Text
                                style={{ fontWeight: "900", color: THEME.text }}
                              >
                                {canSpinToday ? "BISA SPIN" : "TERKUNCI"}
                              </Text>
                              {"\n"}
                              Eligible:{" "}
                              <Text
                                style={{ fontWeight: "900", color: THEME.text }}
                              >
                                {eligible.length}x
                              </Text>
                              {"\n"}
                              Total Hadiah Spin (yang sudah didapat):{" "}
                              <Text
                                style={{ fontWeight: "900", color: THEME.text }}
                              >
                                {rupiah(lastSpinAwardTotal)}
                              </Text>
                            </Text>
                          </View>

                          <TouchableOpacity
                            activeOpacity={0.9}
                            style={[
                              styles.spinPreBtn,
                              (!canSpinToday ||
                                multiSpinLoading ||
                                !eligible.length ||
                                !pending.length ||
                                spinLoading) && { opacity: 0.45 },
                            ]}
                            onPress={spinNext}
                            disabled={
                              !canSpinToday ||
                              multiSpinLoading ||
                              spinLoading ||
                              eligible.length === 0 ||
                              pending.length === 0
                            }
                          >
                            {multiSpinLoading ? (
                              <ActivityIndicator />
                            ) : (
                              <>
                                <Ionicons
                                  name="gift-outline"
                                  size={18}
                                  color="#0F172A"
                                />
                                <Text style={styles.spinPreText}>
                                  {eligible.length === 0
                                    ? "Tidak ada bulan eligible untuk spin"
                                    : pending.length === 0
                                      ? "Semua bulan eligible sudah dapat potongan"
                                      : `Spin ${stepNow}/${stepMax} (untuk ${
                                          monthOptions.find(
                                            (m) => m.key === pending[0],
                                          )?.label || pending[0]
                                        })`}
                                </Text>
                              </>
                            )}
                          </TouchableOpacity>

                          {eligible.length > 0 && (
                            <View style={styles.spinListBox}>
                              {eligible.map((mk) => {
                                const lab =
                                  monthOptions.find((m) => m.key === mk)
                                    ?.label || mk;
                                const val = multiSpinDoneMap[mk];
                                return (
                                  <View key={mk} style={styles.spinListRow}>
                                    <Text style={styles.spinListLeft}>
                                      {lab}
                                    </Text>
                                    <Text
                                      style={[
                                        styles.spinListRight,
                                        val != null &&
                                          val > 0 && { color: "#16A34A" },
                                      ]}
                                    >
                                      {val == null ? "-" : `- ${rupiah(val)}`}
                                    </Text>
                                  </View>
                                );
                              })}
                            </View>
                          )}

                          {/* <Text style={[styles.note, { marginTop: 8 }]}>
                            * Contoh: Jan+Feb+Mar ⇒ Spin 2x: untuk Feb lalu Mar.
                            {"\n"}* Setelah spin, potongan langsung masuk ke
                            rincian invoice (lihat potongan Feb & Mar).
                          </Text> */}
                        </>
                      );
                    })()}
                  </View>
                )}

                {/* ✅ POTONGAN MANUAL */}
                {invoiceDraft.status !== "PAID" && (
                  <View style={{ marginTop: 12 }}>
                    <Text style={styles.invSectionTitle}>
                      Potongan Manual (Voucher)
                    </Text>

                    <View style={styles.invMetaCard}>
                      <Text style={styles.invMetaK}>
                        Berlaku untuk bulan pertama yang dipilih
                      </Text>

                      <TextInput
                        placeholder="Rp 0"
                        keyboardType="numeric"
                        value={
                          manualDiscountInput[invoiceDraft.monthKeys[0]] || ""
                        }
                        style={{
                          marginTop: 8,
                          borderWidth: 1,
                          borderColor: THEME.border,
                          borderRadius: 12,
                          padding: 10,
                          fontWeight: "800",
                          color: THEME.text,
                        }}
                        onChangeText={(v) => {
                          if (!invoiceDraft) return;

                          const mk = invoiceDraft.monthKeys[0];

                          // 🔹 format input rupiah
                          const { raw, formatted } = formatRupiahInput(v);

                          // 1️⃣ update STRING input (biar bisa diketik)
                          setManualDiscountInput((p) => ({
                            ...p,
                            [mk]: formatted,
                          }));

                          // 2️⃣ update ANGKA murni
                          const nextManual = {
                            ...manualDiscounts,
                            [mk]: raw,
                          };
                          setManualDiscounts(nextManual);

                          // 3️⃣ rebuild invoice biar total langsung berkurang
                          setInvoiceDraft((p) =>
                            p ? applyManualDiscountToDraft(p, nextManual) : p,
                          );
                        }}
                      />
                    </View>
                  </View>
                )}

                {/* ✅ rincian (detail per bulan: termasuk potongan Feb & Mar) */}
                <View style={styles.invBox}>
                  <Text style={styles.invSectionMuted}>
                    Rincian Pembayaran (Opsional)
                  </Text>

                  <View style={styles.divDashed} />

                  {invoiceDraft.monthKeys.map((mk, idx) => {
                    const label = invoiceDraft.monthLabels[idx] || mk;
                    const nominal = Number(selected?.spp || 0);
                    const pot = Math.max(
                      Number(invoiceDraft.potonganByMonth?.[mk] || 0),
                      0,
                    );

                    const spin = Math.max(
                      Number(invoiceDraft.spinByMonth?.[mk] || 0),
                      0,
                    );

                    const manual = Math.max(pot - spin, 0);

                    const subTotal = Math.max(nominal - pot, 0);

                    return (
                      <View key={mk} style={styles.itemMonthCard}>
                        <View style={styles.itemMonthRow}>
                          <Text style={styles.itemMonthTitle}>{label}</Text>
                          <Text style={styles.itemMonthNom}>
                            {rupiah(nominal)}
                          </Text>
                        </View>

                        {/* 🔹 POTONGAN SPIN */}
                        {invoiceDraft.spinByMonth?.[mk] > 0 && (
                          <View style={styles.itemMonthRow2}>
                            <Text style={styles.itemMonthSub}>
                              Potongan Voucher
                            </Text>
                            <Text
                              style={[
                                styles.itemMonthSubV,
                                { color: "#16A34A" },
                              ]}
                            >
                              - {rupiah(invoiceDraft.spinByMonth[mk])}
                            </Text>
                          </View>
                        )}

                        {/* POTONGAN SPIN */}
                        {spin > 0 && (
                          <View style={styles.itemMonthRow2}>
                            <Text style={styles.itemMonthSub}>
                              Potongan Voucher
                            </Text>
                            <Text
                              style={[
                                styles.itemMonthSubV,
                                { color: "#16A34A" },
                              ]}
                            >
                              - {rupiah(spin)}
                            </Text>
                          </View>
                        )}

                        {/* POTONGAN MANUAL */}
                        {manual > 0 && (
                          <View style={styles.itemMonthRow2}>
                            <Text style={styles.itemMonthSub}>
                              Potongan Manual
                            </Text>
                            <Text
                              style={[
                                styles.itemMonthSubV,
                                { color: "#16A34A" },
                              ]}
                            >
                              - {rupiah(manual)}
                            </Text>
                          </View>
                        )}

                        {/* ⬇️ NAH INI DIA, LETAKNYA DI SINI */}
                        {manualDiscounts?.[mk] > 0 && (
                          <Text
                            style={{
                              marginTop: 2,
                              fontSize: 11,
                              fontWeight: "700",
                              color: "#16A34A",
                            }}
                          >
                            ✓ Potongan Manual
                          </Text>
                        )}

                        <View style={styles.itemMonthRow2}>
                          <Text style={styles.itemMonthSub}>Subtotal</Text>
                          <Text style={styles.itemMonthSubV}>
                            {rupiah(subTotal)}
                          </Text>
                        </View>
                      </View>
                    );
                  })}

                  <View style={styles.divSolid} />

                  <View style={styles.invRow}>
                    <Text style={styles.invK}>Nominal SPP (Total)</Text>
                    <Text style={styles.invV}>
                      {rupiah(invoiceDraft.nominal)}{" "}
                      <Text style={{ color: THEME.sub, fontWeight: "800" }}>
                        ({invoiceDraft.monthKeys.length} bulan)
                      </Text>
                    </Text>
                  </View>

                  <View style={styles.invRow}>
                    <Text style={styles.invK}>Potongan (Total)</Text>
                    <Text
                      style={[
                        styles.invV,
                        invoiceDraft.potongan > 0 && { color: "#16A34A" },
                      ]}
                    >
                      - {rupiah(invoiceDraft.potongan)}
                    </Text>
                  </View>

                  <View style={styles.invTotalRow}>
                    <Text style={styles.invTotalK}>TOTAL BAYAR</Text>
                    <Text style={styles.invTotalV}>
                      {rupiah(invoiceDraft.total)}
                    </Text>
                  </View>
                </View>

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
                              p ? { ...p, metode: m } : p,
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
  invSummaryCard: {
    marginTop: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.95)",
    backgroundColor: "#F8FAFC",
    padding: 14,
  },

  invRowSimple: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },

  invLabel: {
    color: "#64748B",
    fontWeight: "700",
    fontSize: 12,
  },

  invValue: {
    color: "#0F172A",
    fontWeight: "900",
    fontSize: 13,
  },

  invSectionMuted: {
    marginTop: 12,
    fontWeight: "900",
    color: "#475569",
    fontSize: 12,
  },

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
    marginTop: 10,
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

  // ✅ spin ui
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

  spinListBox: {
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.95)",
    backgroundColor: "rgba(248,250,252,1)",
    padding: 10,
  },
  spinListRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(226,232,240,0.65)",
  },
  spinListLeft: { fontWeight: "900", color: THEME.text, fontSize: 12 },
  spinListRight: { fontWeight: "900", color: THEME.sub, fontSize: 12 },

  // ✅ per-bulan card di rincian
  itemMonthCard: {
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.95)",
    backgroundColor: "#fff",
    padding: 10,
  },
  itemMonthRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "center",
  },
  itemMonthTitle: { fontWeight: "900", color: THEME.text, fontSize: 12 },
  itemMonthNom: { fontWeight: "900", color: THEME.text, fontSize: 12 },
  itemMonthRow2: {
    marginTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  itemMonthSub: { fontWeight: "800", color: THEME.sub, fontSize: 12 },
  itemMonthSubV: { fontWeight: "900", color: THEME.text, fontSize: 12 },

  closeBtn2: { marginTop: 10, alignItems: "center" },
  closeText2: { fontWeight: "900", color: "#EF4444" },
});

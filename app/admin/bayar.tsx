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
  invoiceNo: string;

  studentId: string;
  studentName: string;
  studentType: Student["type"];

  branchId: string;
  branchName: string;

  monthKey: string; // YYYY-MM (bulan yang dibayar)
  monthLabel: string;

  nominal: number;
  potongan: number;
  total: number;

  metode: "Cash" | "Transfer";

  status: "UNPAID" | "PAID";
  createdAtLocal: Date; // waktu preview invoice (sebelum bayar)
  paidAtText?: string;

  // ✅ bukti pembayaran disimpan di Firestore (Base64 Data URL)
  proofDataUrl?: string | null; // "data:image/jpeg;base64,...."
  proofMime?: string | null; // "image/jpeg"
  proofType?: "camera" | "gallery" | null;
};

type ProofLocal = {
  // uri file hasil resize/compress lokal (buat preview cepat)
  uri: string;
  // dataUrl hasil base64 yang akan disimpan ke Firestore
  dataUrl: string;
  mime: string;
  source: "camera" | "gallery";
  bytesApprox?: number; // estimasi ukuran base64 (opsional)
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
function nextMonthKey(d: Date) {
  const nd = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return monthKeyOf(nd);
}
function nextMonthLabel(d: Date) {
  const nd = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return monthLabelOf(nd);
}

// random sesuai peluang (weight)
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

  // 1) resize + compress (JPEG)
  const manip = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: maxWidth } }],
    { compress, format: ImageManipulator.SaveFormat.JPEG }
  );

  // 2) read file as base64
  const b64 = await FileSystem.readAsStringAsync(manip.uri, {
    encoding: "base64" as any,
  });

  // approx size bytes (base64 length * 0.75)
  const bytesApprox = Math.floor((b64.length * 3) / 4);

  const dataUrl = `data:image/jpeg;base64,${b64}`;

  return { dataUrl, uri: manip.uri, mime: "image/jpeg", bytesApprox };
}

export default function BayarSPP() {
  const today = new Date();
  const day = today.getDate();

  // ===================== SETTING SPIN (Firestore) =====================
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

  // ===================== SISWA REALTIME (students by branch) =====================
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

  // ===================== INVOICE MODAL STATE =====================
  const [selected, setSelected] = useState<Student | null>(null);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceDraft, setInvoiceDraft] = useState<InvoiceDraft | null>(null);

  const [payLoading, setPayLoading] = useState(false);

  // ✅ bukti pembayaran local + base64
  const [proofLocal, setProofLocal] = useState<ProofLocal | null>(null);
  const [processingProof, setProcessingProof] = useState(false);

  // spin bonus (bulan depan) state
  const [spinBonusLoading, setSpinBonusLoading] = useState(false);
  const [spinBonusDone, setSpinBonusDone] = useState(false);
  const [spinBonusText, setSpinBonusText] = useState("");

  const showLoading = profileLoading || studentLoading;

  async function ensurePerms() {
    // Media library
    const lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (lib.status !== "granted") {
      Alert.alert(
        "Izin dibutuhkan",
        "Izinkan akses galeri untuk upload bukti."
      );
      return false;
    }
    // Camera
    const cam = await ImagePicker.requestCameraPermissionsAsync();
    if (cam.status !== "granted") {
      // kamera boleh tidak granted (kalau user cuma mau galeri)
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
        quality: 1, // biar kita yang kompres dengan manipulator
      });

      if (res.canceled) return;

      const a = res.assets?.[0];
      if (!a?.uri) return;

      setProcessingProof(true);
      const made = await makeProofDataUrl(a.uri, {
        maxWidth: 720,
        compress: 0.5,
      });

      // Safety: kalau kebesaran, kasih info (tetap disimpan, tapi user tau)
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
      p
        ? {
            ...p,
            proofDataUrl: null,
            proofMime: null,
            proofType: null,
          }
        : p
    );
  }

  // ===================== OPEN INVOICE (PREVIEW BEFORE PAY) =====================
  async function openInvoice(s: Student) {
    if (!branchId) {
      Alert.alert("Cabang belum siap", "Tunggu data cabang admin ter-load.");
      return;
    }

    setSelected(s);
    setInvoiceOpen(true);
    setInvoiceLoading(true);
    setInvoiceDraft(null);
    setSpinBonusDone(false);
    setSpinBonusText("");
    setProofLocal(null);

    try {
      const now = new Date();
      const mk = monthKeyOf(now);
      const invNo = `INV-${branchId}-${mk}-${s.id}`;

      const invRef = doc(db, "invoices", invNo);
      const invSnap = await getDoc(invRef);

      const discId = `${s.id}_${mk}`;
      const discRef = doc(db, "student_discounts", discId);
      const discSnap = await getDoc(discRef);

      const nominal = Number(s.spp || 0);
      const potongan = discSnap.exists()
        ? Math.max(Number((discSnap.data() as any)?.nominal || 0), 0)
        : 0;

      const total = Math.max(nominal - potongan, 0);

      if (invSnap.exists()) {
        const data = invSnap.data() as any;
        const paidAt = data?.paidAt?.toDate ? data.paidAt.toDate() : null;
        const paidAtText = paidAt ? formatTanggalJam(paidAt) : "-";

        setInvoiceDraft({
          invoiceNo: invNo,
          studentId: s.id,
          studentName: s.name,
          studentType: s.type,
          branchId,
          branchName,
          monthKey: mk,
          monthLabel: monthLabelOf(now),
          nominal: Number(data.nominal ?? nominal) || 0,
          potongan: Number(data.potongan ?? potongan) || 0,
          total: Number(data.total ?? total) || 0,
          metode: (data.metode as any) || "Cash",
          status: "PAID",
          createdAtLocal: now,
          paidAtText,
          proofDataUrl: data.proofDataUrl || null,
          proofMime: data.proofMime || null,
          proofType: data.proofType || null,
        });

        const nextMk = nextMonthKey(now);
        const bonusId = `${s.id}_${nextMk}`;
        const bonusRef = doc(db, "student_discounts", bonusId);
        const bonusSnap = await getDoc(bonusRef);
        if (bonusSnap.exists()) {
          const b = bonusSnap.data() as any;
          setSpinBonusDone(true);
          setSpinBonusText(
            `Sudah dapat potongan ${rupiah(Number(b.nominal || 0))} (${String(
              b.label || "Bonus"
            )}) untuk ${nextMonthLabel(now)}`
          );
        }
      } else {
        setInvoiceDraft({
          invoiceNo: invNo,
          studentId: s.id,
          studentName: s.name,
          studentType: s.type,
          branchId,
          branchName,
          monthKey: mk,
          monthLabel: monthLabelOf(now),
          nominal,
          potongan,
          total,
          metode: "Cash",
          status: "UNPAID",
          createdAtLocal: now,
          proofDataUrl: null,
          proofMime: null,
          proofType: null,
        });
      }
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
    setSpinBonusDone(false);
    setSpinBonusText("");
    setProofLocal(null);
  }

  // ===================== PAY: SAVE INVOICE + PAYMENT + PROOF BASE64 =====================
  async function confirmPay() {
    if (!invoiceDraft || !branchId) return;

    try {
      setPayLoading(true);

      const u = auth.currentUser;
      if (!u) {
        Alert.alert("Unauth", "Silakan login ulang.");
        return;
      }

      // ✅ kalau Transfer, wajib ada bukti (local atau sudah ada di invoiceDraft)
      const hasProof = !!proofLocal?.dataUrl || !!invoiceDraft.proofDataUrl;

      if (invoiceDraft.metode === "Transfer" && !hasProof) {
        Alert.alert(
          "Bukti Transfer",
          "Untuk metode Transfer, wajib upload/foto bukti dulu."
        );
        return;
      }

      const invNo = invoiceDraft.invoiceNo;

      // ambil bukti dari local (lebih prioritas), kalau tidak ada pakai existing
      const proofDataUrl =
        proofLocal?.dataUrl || invoiceDraft.proofDataUrl || null;
      const proofMime = proofLocal?.mime || invoiceDraft.proofMime || null;
      const proofType =
        (proofLocal?.source as any) || invoiceDraft.proofType || null;

      await runTransaction(db, async (trx) => {
        const invRef = doc(db, "invoices", invNo);
        const invSnap = await trx.get(invRef);
        if (invSnap.exists()) return; // sudah bayar

        const payload: any = {
          invoiceNo: invNo,
          monthKey: invoiceDraft.monthKey,
          monthLabel: invoiceDraft.monthLabel,
          studentId: invoiceDraft.studentId,
          studentName: invoiceDraft.studentName,
          studentType: invoiceDraft.studentType,
          branchId,
          branchName,
          nominal: invoiceDraft.nominal,
          potongan: invoiceDraft.potongan,
          total: invoiceDraft.total,
          metode: invoiceDraft.metode,
          status: "PAID",
          paidAt: serverTimestamp(),
          paidByUid: u.uid,
          createdAt: serverTimestamp(),
        };

        // ✅ simpan bukti base64 ke Firestore (tanpa Storage)
        if (proofDataUrl) {
          payload.proofDataUrl = proofDataUrl;
          payload.proofMime = proofMime || "image/jpeg";
          payload.proofType = proofType || "upload";
          payload.proofUploadedAt = serverTimestamp();
        }

        trx.set(invRef, payload);
        trx.set(doc(db, "payments", invNo), payload);
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

      Alert.alert("✅ Lunas", "Pembayaran berhasil disimpan.");
    } catch (e: any) {
      console.log(e);

      // kalau error karena ukuran dokumen (base64 terlalu besar)
      const msg = String(e?.message || "");
      if (
        msg.toLowerCase().includes("maximum") ||
        msg.toLowerCase().includes("size")
      ) {
        Alert.alert(
          "Gagal",
          "Ukuran bukti terlalu besar untuk Firestore. Coba pilih gambar lain / foto ulang, atau nanti aku turunkan resize jadi 720px & compress 0.5."
        );
        return;
      }

      Alert.alert("Gagal", e?.message || "Pembayaran gagal.");
    } finally {
      setPayLoading(false);
    }
  }

  // ===================== SPIN BONUS AFTER PAY =====================
  async function spinBonusBulanDepan() {
    if (!invoiceDraft || !selected) return;

    if (spinLoading) {
      Alert.alert("Tunggu", "Setting spin masih dimuat...");
      return;
    }
    if (!canSpinToday) {
      Alert.alert(
        "Spin Ditutup",
        `Spin hanya bisa dilakukan sebelum tanggal ${sebelumTanggal}.`
      );
      return;
    }
    if (invoiceDraft.status !== "PAID") {
      Alert.alert("Belum Lunas", "Bayar dulu supaya bisa spin bonus.");
      return;
    }

    const picked = pickByWeight(hadiah);
    if (!picked) {
      Alert.alert("Gagal", "Data hadiah kosong / peluang 0 semua.");
      return;
    }

    try {
      setSpinBonusLoading(true);

      const now = new Date();
      const nextMk = nextMonthKey(now);
      const bonusId = `${selected.id}_${nextMk}`;
      const refx = doc(db, "student_discounts", bonusId);

      const snap = await getDoc(refx);
      if (snap.exists()) {
        const b = snap.data() as any;
        setSpinBonusDone(true);
        setSpinBonusText(
          `Sudah dapat potongan ${rupiah(Number(b.nominal || 0))} (${String(
            b.label || "Bonus"
          )}) untuk ${nextMonthLabel(now)}`
        );
        Alert.alert("Info", "Bonus bulan depan sudah pernah dibuat.");
        return;
      }

      await runTransaction(db, async (trx) => {
        const again = await trx.get(refx);
        if (again.exists()) return;

        trx.set(refx, {
          studentId: selected.id,
          studentName: selected.name,
          branchId,
          branchName,
          monthKey: nextMk,
          label: picked.label,
          nominal: Math.max(Number(picked.nominal || 0), 0),
          createdAt: serverTimestamp(),
          source: "SPIN_BONUS_AFTER_PAY",
          sourceInvoiceNo: invoiceDraft.invoiceNo,
          dipakaiBulanDepan: dipakaiBulanDepan !== false,
        });
      });

      setSpinBonusDone(true);
      setSpinBonusText(
        `Berhasil: potongan ${rupiah(picked.nominal)} (${
          picked.label
        }) untuk ${nextMonthLabel(now)}`
      );

      Alert.alert(
        "🎁 Hasil Spin",
        `${selected.name}\nHadiah: ${
          picked.label
        }\nPotongan bulan depan: ${rupiah(picked.nominal)}`
      );
    } catch (e: any) {
      console.log(e);
      Alert.alert("Gagal", e?.message || "Spin gagal disimpan.");
    } finally {
      setSpinBonusLoading(false);
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={[THEME.bg1, THEME.bg2, THEME.bg3]}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.brand}>Shining Sun 🎈</Text>
        <Text style={styles.title}>Bayar SPP</Text>
        <Text style={styles.subtitle}>
          Cabang:{" "}
          <Text style={{ fontWeight: "900", color: THEME.text }}>
            {branchName}
          </Text>
          {"\n"}
          Klik siswa → muncul invoice → baru bayar.
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
          ℹ️ Jika bayar sebelum tanggal {sebelumTanggal}, bisa spin bonus
          (potongan bulan depan).
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

                {/* meta */}
                <View style={styles.invMetaCard}>
                  <View style={styles.invMetaRow}>
                    <Text style={styles.invMetaK}>Bulan Tagihan</Text>
                    <Text style={styles.invMetaV}>
                      {invoiceDraft.monthLabel}
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
                      {rupiah(invoiceDraft.nominal)}
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

                {/* ✅ BUKTI PEMBAYARAN (SEBELUM BAYAR SEKARANG) */}
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
                      Pembayaran sudah LUNAS untuk bulan ini.
                    </Text>
                  </View>
                )}

                {/* kalau sudah PAID, tampilkan bukti kalau ada */}
                {invoiceDraft.status === "PAID" &&
                  !!invoiceDraft.proofDataUrl && (
                    <View style={{ marginTop: 12 }}>
                      <Text style={styles.invSectionTitle}>
                        Bukti Pembayaran
                      </Text>
                      <Image
                        source={{ uri: invoiceDraft.proofDataUrl }}
                        style={styles.proofImage}
                      />
                      <Text style={[styles.note, { marginTop: 8 }]}>
                        (Tersimpan di Firestore •{" "}
                        {invoiceDraft.proofType || "upload"})
                      </Text>
                    </View>
                  )}

                {/* Info spin */}
                <View style={styles.nextInfo}>
                  <Text style={styles.nextInfoText}>
                    🎁 Jika bayar sebelum tanggal {sebelumTanggal}, bisa{" "}
                    <Text style={{ fontWeight: "900", color: THEME.text }}>
                      Spin Bonus
                    </Text>{" "}
                    untuk potongan tagihan{" "}
                    <Text style={{ fontWeight: "900", color: THEME.text }}>
                      {nextMonthLabel(new Date())}
                    </Text>
                    .
                  </Text>
                </View>

                <TouchableOpacity
                  activeOpacity={0.9}
                  style={[
                    styles.spinBonusBtn,
                    (spinLoading ||
                      spinBonusLoading ||
                      !canSpinToday ||
                      invoiceDraft.status !== "PAID" ||
                      spinBonusDone) && { opacity: 0.45 },
                  ]}
                  onPress={spinBonusBulanDepan}
                  disabled={
                    spinLoading ||
                    spinBonusLoading ||
                    !canSpinToday ||
                    invoiceDraft.status !== "PAID" ||
                    spinBonusDone
                  }
                >
                  {spinBonusLoading ? (
                    <ActivityIndicator />
                  ) : (
                    <>
                      <Ionicons name="gift-outline" size={18} color="#0F172A" />
                      <Text style={styles.spinBonusText}>
                        {spinBonusDone
                          ? "Bonus Sudah Dibuat"
                          : "Spin Bonus Bulan Depan"}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                {!!spinBonusText && (
                  <Text style={[styles.note, { marginTop: 10 }]}>
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
  brand: { color: "#2563EB", fontWeight: "900" },
  title: { fontSize: 26, fontWeight: "900", marginTop: 6, color: THEME.text },
  subtitle: {
    color: THEME.sub,
    marginTop: 6,
    marginBottom: 12,
    fontWeight: "700",
    lineHeight: 18,
  },

  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: THEME.border,
    marginBottom: 12,
  },
  searchInput: { flex: 1, fontWeight: "800", color: THEME.text },

  card: {
    backgroundColor: THEME.card,
    borderRadius: 20,
    padding: 12,
    borderWidth: 1,
    borderColor: THEME.border,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "#fff",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 16,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
  },
  name: { fontWeight: "900", color: THEME.text },
  meta: { color: THEME.sub, fontWeight: "700", fontSize: 12 },

  note: {
    marginTop: 10,
    textAlign: "center",
    color: "#64748B",
    fontWeight: "800",
    fontSize: 12,
  },

  backdrop: {
    flex: 1,
    backgroundColor: "rgba(2,6,23,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },

  invoiceCard: {
    width: "100%",
    maxWidth: 430,
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.border,
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
    borderBottomColor: THEME.border,
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
    borderColor: THEME.border,
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
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
  },
  invName: { fontWeight: "900", color: THEME.text, fontSize: 14 },
  invMuted: { marginTop: 2, fontWeight: "800", color: THEME.sub, fontSize: 12 },

  invMetaCard: {
    marginTop: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: THEME.border,
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
    borderColor: THEME.border,
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
    borderColor: THEME.border,
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

  // ✅ proof UI
  proofBox: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: THEME.border,
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
  proofEmptyText: { color: THEME.sub, fontWeight: "800", fontSize: 12 },
  proofBtn: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.border,
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
    borderColor: THEME.border,
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
  paidText: { fontWeight: "900", color: "#0F172A" },

  nextInfo: {
    marginTop: 10,
    backgroundColor: "rgba(219,234,254,0.75)",
    borderWidth: 1,
    borderColor: "rgba(191,219,254,1)",
    padding: 10,
    borderRadius: 14,
  },
  nextInfoText: {
    color: THEME.text,
    fontWeight: "800",
    fontSize: 12,
    lineHeight: 16,
  },

  spinBonusBtn: {
    marginTop: 10,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    borderWidth: 1,
    borderColor: THEME.border,
    backgroundColor: "#fff",
  },
  spinBonusText: { fontWeight: "900", color: THEME.text },

  closeBtn2: { marginTop: 10, alignItems: "center" },
  closeText2: { fontWeight: "900", color: "#EF4444" },
});

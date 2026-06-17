// FILE: app/superadmin/siswa.tsx
import { Ionicons } from "@expo/vector-icons";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

// ✅ Firebase
import DateTimePicker from "@react-native-community/datetimepicker";
import * as FileSystem from "expo-file-system";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../../firebase"; // ✅ sesuaikan path

type Cabang = { id: string; nama: string };

type Student = {
  id: string;
  name: string;
  cabangId: string;
  cabangNama: string; // hasil join dari branches
  tipe: string;
  spp: number;
  active: boolean; // ✅ TAMBAHKAN INI
};

type PaidRow = {
  id: string;
  invoiceNo: string; // 🔥 TAMBAHKAN
  bulan: string;
  tanggal: string;
  jam: string;
  nominal: number;
  potongan: number;
  dibayar: number;
  metode: "Cash" | "Transfer";
  monthKey: string;

  // ✅ bukti bayar (ikuti yang dipakai Bayar SPP)
  proofDataUrl?: string | null;
  proofType?: "camera" | "gallery" | "upload" | null;
};

// 🎨 Font Map (Inter)
const F = {
  regular: "Inter_400Regular",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  extrabold: "Inter_800ExtraBold",
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function formatTanggal(d: Date) {
  return `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()}`;
}
function formatJam(d: Date) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function bulanIndo(date: Date) {
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
  return `${bulan[date.getMonth()]} ${date.getFullYear()}`;
}
function monthLabelFromMonthKey(monthKey: string) {
  // monthKey: YYYY-MM
  const [yStr, mStr] = String(monthKey || "").split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12)
    return monthKey || "-";
  return bulanIndo(new Date(y, m - 1, 1));
}

function formatRupiahInput(value: string) {
  const number = value.replace(/\D/g, "");
  if (!number) return "Rp ";
  const formatted = number.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return "Rp " + formatted;
}

function parseRupiah(value: string) {
  const clean = value.replace(/[^0-9]/g, "");
  return Number(clean) || 0;
}

function rupiah(n: number) {
  return "Rp " + Number(n || 0).toLocaleString("id-ID");
}

export default function SiswaByCabangPage() {
  // ---------- KPI STATE ----------
  const [summary, setSummary] = useState({
    totalMasuk: 0, // total nominal masuk bulan ini
    bayar: 0,      // siswa yang sudah bayar
    belum: 0,     // siswa belum bayar
    totalSiswa: 0, // total siswa aktif
  });
  const [loadingKpi, setLoadingKpi] = useState(true);

  const insets = useSafeAreaInsets();
  const tabH = useBottomTabBarHeight();

  // ====== CABANG dari Firestore (branches) ======
  const [cabangRows, setCabangRows] = useState<Cabang[]>([]);
  const [loadingCabang, setLoadingCabang] = useState(true);

  // ====== SISWA dari Firestore (students) ======
  const [siswaAll, setSiswaAll] = useState<Student[]>([]);
  const [loadingSiswa, setLoadingSiswa] = useState(true);

  // ====== MUTASI dari Firestore (payments) ======
  const [history, setHistory] = useState<PaidRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [cabang, setCabang] = useState<string>("Semua"); // "Semua" atau cabangId
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Student | null>(null);

  // ================= STATUS BAYAR BULAN INI =================
  const [sudahBayar, setSudahBayar] = useState<Student[]>([]);
  const [belumBayar, setBelumBayar] = useState<Student[]>([]);
  const [filterMode, setFilterMode] = useState<"terbayar" | "belum">("belum");

  // ================= RANGE TANGGAL =================
  const today = new Date();

  const [fromDate, setFromDate] = useState<Date>(
    new Date(today.getFullYear(), today.getMonth(), 1),
  );

  const [toDate, setToDate] = useState<Date>(today);

  const currentMonthKey = `${today.getFullYear()}-${String(
    today.getMonth() + 1,
  ).padStart(2, "0")}`;

  const [selectedMonthKey, setSelectedMonthKey] = useState(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`,
  );

  const [appliedMonthKey, setAppliedMonthKey] = useState(selectedMonthKey);

  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  const [branchName, setBranchName] = useState("-");

  function atStartOfDay(d: Date) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  }

  function atEndOfDay(d: Date) {
    return new Date(
      d.getFullYear(),
      d.getMonth(),
      d.getDate(),
      23,
      59,
      59,
      999,
    );
  }

  function monthKeyFromDate(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  function applyMonthFilter() {
    setAppliedMonthKey(selectedMonthKey);
  }

  const [totalNominalRange, setTotalNominalRange] = useState(0);

  // ✅ modal preview bukti
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState<PaidRow | null>(null);

  // ===== EDIT STATE =====
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<PaidRow | null>(null);

  const [editNominal, setEditNominal] = useState("");
  const [editPotongan, setEditPotongan] = useState("");
  const [editMetode, setEditMetode] = useState<"Cash" | "Transfer">("Cash");
  const [editTanggal, setEditTanggal] = useState("");
  const [editJam, setEditJam] = useState("");
  const [editBulan, setEditBulan] = useState("");

  const [showEditDatePicker, setShowEditDatePicker] = useState(false);

  // ✅ dropdown cabang (baru)
  const [cabangPickerOpen, setCabangPickerOpen] = useState(false);
  const [cabangPickerSearch, setCabangPickerSearch] = useState("");

  function openPreview(item: PaidRow) {
    if (!item.proofDataUrl) return;
    setPreviewItem(item);
    setPreviewOpen(true);
  }

  function openEdit(item: PaidRow) {
    setEditItem(item);
    setEditNominal(formatRupiahInput(String(item.nominal)));
    setEditPotongan(formatRupiahInput(String(item.potongan)));
    setEditMetode(item.metode);
    setEditTanggal(item.tanggal);
    setEditJam(item.jam);
    setEditBulan(item.bulan);
    setEditOpen(true);
  }

  async function handleSaveEdit() {
    if (!editItem || !selected) return;

    if (!editTanggal || !editJam) {
      Alert.alert("Error", "Tanggal atau jam tidak valid");
      return;
    }

    try {
      const nominal = parseRupiah(editNominal);
      const potongan = parseRupiah(editPotongan);
      const totalFinal = Math.max(nominal - potongan, 0);

      const [dd, mm, yyyy] = editTanggal.split("-");
      const [hh, min] = editJam.split(":");

      const newDate = new Date(
        Number(yyyy),
        Number(mm) - 1,
        Number(dd),
        Number(hh),
        Number(min),
      );

      // ===============================
      // 🔥 CONVERT BULAN → monthKey
      // ===============================
      let newMonthKey = "";
      try {
        const parts = editBulan.split(" ");
        const monthName = parts[0];
        const year = parts[1];

        const bulanList = [
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

        const monthIndex = bulanList.indexOf(monthName) + 1;

        if (monthIndex > 0) {
          newMonthKey = `${year}-${String(monthIndex).padStart(2, "0")}`;
        }
      } catch {}

      // ===============================
      // 1️⃣ UPDATE FIRESTORE
      // ===============================
      const newMonthLabel = newMonthKey
        ? monthLabelFromMonthKey(newMonthKey)
        : editBulan || null;

      await updateDoc(doc(db, "payments", editItem.id), {
        nominal: nominal,
        potongan: potongan,
        dibayar: totalFinal,
        totalBayar: totalFinal,
        total: totalFinal,
        metode: editMetode,
        paidAt: newDate,
        jam: editJam,
        monthKey: newMonthKey || null,
        monthLabel: newMonthLabel,
        jenisPembayaran: editBulan || null,
      });

      // ===============================
      // 2️⃣ UPDATE SPREADSHEET (SAMA ADMIN)
      // ===============================
      try {
        const response = await fetch(
          "https://script.google.com/macros/s/AKfycbwZGJdMIwEo_XDW4lDoOxY21t4Qfv5NvoXY8PAKU-Fb7747LAl2x_dmkUp5zR_JJLcrwg/exec",
          {
            method: "POST",
            redirect: "follow",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              action: "upsert",
              paymentId: editItem.id.trim(),
              branchName: selected.cabangNama.trim(),
              tanggal: editTanggal,
              jam: editJam,
              jenisPembayaran: editBulan,
              studentName: selected.name,
              studentType: selected.tipe,
              metode: editMetode,
              nominalSebelumVoucher: nominal,
              voucherSpin: potongan,
              voucherManual: 0,
              totalVoucher: potongan,
              voucherSpinDetail: "-",
              totalDibayar: totalFinal,
            }),
          },
        );

        if (!response.ok) {
          console.log("Spreadsheet update gagal:", await response.text());
        }
      } catch (sheetErr: any) {
        console.log("Spreadsheet sync error:", sheetErr?.message);
      }

      Alert.alert("Berhasil", "Pembayaran berhasil diperbarui");
      closeEdit();
    } catch (e: any) {
      Alert.alert("Gagal", e?.message || "Gagal update pembayaran");
    }
  }

  // ===============================
  // 🔥 DELETE TRANSAKSI (SUPERADMIN ONLY)
  // ===============================
  // ===============================
  // 🔥 DELETE TRANSAKSI (SUPERADMIN ONLY)
  // ===============================
  async function handleDelete(item: PaidRow) {
    if (!selected) return;

    Alert.alert(
      "Hapus Transaksi",
      "Yakin ingin menghapus transaksi ini? Data akan hilang permanen.",
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Hapus",
          style: "destructive",
          onPress: async () => {
            try {
              // 🔥 DEBUG
              console.log("DELETE FIRESTORE ID:", item.id);
              console.log("DELETE SHEET ID:", item.invoiceNo);

              // // 1️⃣ HAPUS FIRESTORE (pakai document id)
              try {
                await deleteDoc(doc(db, "payments", item.id));
              } catch (e) {
                console.log("Delete payments error:", e);
                // Fallback: jika delete diblokir rules, ubah status jadi DELETED
                try {
                  await updateDoc(doc(db, "payments", item.id), { status: "DELETED", totalBayar: 0 });
                } catch (e2) {}
              }

              try {
                await updateDoc(doc(db, "invoices", item.id), { status: "UNPAID" }); // ✅ Ubah status jadi UNPAID daripada delete untuk menghindari error permission
              } catch (e) {
                console.log("Update invoice error:", e);
                try {
                   await deleteDoc(doc(db, "invoices", item.id)); // Fallback hapus jika update gagal
                } catch(e2) {}
              }

              if (item.monthKey && selected?.id) {
                // ✅ KEMBALIKAN VOUCHER YANG DIPAKAI UNTUK BULAN INI
                try {
                  const usedDiscRef = doc(db, "student_discounts", `${selected.id}_${item.monthKey}`);
                  await updateDoc(usedDiscRef, {
                    status: "AVAILABLE",
                    usedAt: null,
                    usedByPaymentGroupId: null
                  });
                } catch (e) {}

                // ✅ HAPUS VOUCHER YANG DIDAPAT (UNTUK BULAN DEPAN) HASIL DARI PEMBAYARAN INI
                try {
                  const [y, m] = item.monthKey.split("-").map(Number);
                  const d = new Date(y, m, 1);
                  const targetMk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                  const earnedDiscRef = doc(db, "student_discounts", `${selected.id}_${targetMk}`);
                  await deleteDoc(earnedDiscRef);
                } catch (e) {}

                // ✅ HAPUS MANUAL DISCOUNT JIKA ADA
                try {
                   await deleteDoc(doc(db, "manual_discounts", `${selected.id}_${item.monthKey}`));
                } catch(e) {}
              }

              // 2️⃣ HAPUS SPREADSHEET (pakai invoiceNo)
              const res = await fetch(
                "https://script.google.com/macros/s/AKfycbwZGJdMIwEo_XDW4lDoOxY21t4Qfv5NvoXY8PAKU-Fb7747LAl2x_dmkUp5zR_JJLcrwg/exec",
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    action: "delete",
                    paymentId: item.invoiceNo.trim(), // 🔥 PAKAI INV
                    branchName: selected.cabangNama.trim(),
                  }),
                },
              );

              const raw = await res.text();
              console.log("DELETE SHEET RESPONSE RAW:", raw);

              const parsed = JSON.parse(raw);
              console.log("DELETE SHEET RESPONSE PARSED:", parsed);

              if (!parsed.ok) {
                throw new Error(parsed.error || "Sheet delete gagal");
              }

              if (parsed.action === "deleted") {
                Alert.alert("Berhasil", "Transaksi berhasil dihapus.");
              } else if (parsed.action === "not_found") {
                Alert.alert("Warning", "Data tidak ditemukan di Spreadsheet.");
              } else {
                Alert.alert("Info", "Tidak ada data yang dihapus.");
              }
            } catch (err: any) {
              console.log("DELETE ERROR:", err);
              Alert.alert(
                "Error",
                err?.message || "Gagal menghapus transaksi.",
              );
            }
          },
        },
      ],
    );
  }

  function closeEdit() {
    setEditOpen(false);
    setEditItem(null);
  }

  function closePreview() {
    setPreviewOpen(false);
    setPreviewItem(null);
  }

  // ===================== EXPORT EXCEL (CSV) =====================
  async function handleExportExcel() {
    try {
      const dataToExport = filterMode === "terbayar" ? sudahBayar : belumBayar;
      if (dataToExport.length === 0) {
        Alert.alert("Kosong", "Tidak ada data siswa untuk di-export.");
        return;
      }

      let csvContent = "Nama,Unit,Tipe,Spp,Status\n";
      dataToExport.forEach((s) => {
        const cleanName = s.name.replace(/"/g, '""');
        const cleanUnit = s.cabangNama.replace(/"/g, '""');
        const status = filterMode === "terbayar" ? "Terbayar" : "Belum Bayar";
        csvContent += `"${cleanName}","${cleanUnit}","${s.tipe}","${s.spp}","${status}"\n`;
      });

      const fileName = `Export_Siswa_${filterMode}_${Date.now()}.csv`;

      if (Platform.OS === "web") {
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);
      } else if (Platform.OS === "android") {
        const SAF = (FileSystem as any).StorageAccessFramework;
        const permissions = await SAF.requestDirectoryPermissionsAsync();
        if (permissions.granted) {
          const uri = await SAF.createFileAsync(
            permissions.directoryUri,
            fileName,
            "text/csv",
          );
          await (FileSystem as any).writeAsStringAsync(uri, csvContent, {
            encoding: (FileSystem as any).EncodingType.UTF8,
          });
          Alert.alert("Berhasil", "Data berhasil di-export sebagai file CSV (bisa dibuka di Excel).");
        } else {
          Alert.alert("Gagal", "Izin akses folder ditolak.");
        }
      } else {
        Alert.alert(
          "Info",
          "Fitur simpan file langsung saat ini hanya didukung di versi Web dan Android."
        );
      }
    } catch (error: any) {
      console.log(error);
      Alert.alert("Error", error?.message || "Gagal meng-export data.");
    }
  }

  // ===================== LOAD CABANG (branches) =====================
  useEffect(() => {
    async function loadCabang() {
      try {
        setLoadingCabang(true);

        const snap = await getDocs(
          query(collection(db, "branches"), orderBy("createdAt", "asc")),
        );

        const rows: Cabang[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            nama: String(data.name || data.branchName || "").trim(),
          };
        });

        setCabangRows(rows);
      } catch (err) {
        console.log(err);
        Alert.alert("Gagal", "Tidak bisa mengambil data unit.");
      } finally {
        setLoadingCabang(false);
      }
    }

    loadCabang();
  }, []);

  // cabangList utk filter (Semua + hasil branches)
  const cabangList = useMemo(() => {
    const base = [{ id: "Semua", nama: "Semua" }];
    return base.concat(cabangRows);
  }, [cabangRows]);

  // helper nama cabang dari id
  const cabangNameById = useMemo(() => {
    const map = new Map<string, string>();
    cabangRows.forEach((c) => map.set(c.id, c.nama));
    return (id: string) => map.get(id) || "-";
  }, [cabangRows]);

  const cabangLabel = useMemo(() => {
    if (cabang === "Semua") return "Semua";
    return cabangNameById(cabang);
  }, [cabang, cabangNameById]);

  const cabangFiltered = useMemo(() => {
    const qq = cabangPickerSearch.trim().toLowerCase();
    if (!qq) return cabangList;
    return cabangList.filter((x) => x.nama.toLowerCase().includes(qq));
  }, [cabangList, cabangPickerSearch]);

  // ===================== LOAD SISWA (students) =====================
  useEffect(() => {
    async function loadSiswa() {
      try {
        setLoadingSiswa(true);

        const qRef =
          cabang === "Semua"
            ? query(collection(db, "students"), orderBy("createdAt", "desc"))
            : query(
                collection(db, "students"),
                where("branchId", "==", cabang),
                orderBy("createdAt", "desc"),
              );

        const snap = await getDocs(qRef);

        const rows: Student[] = snap.docs.map((d) => {
          const data = d.data() as any;

          const cabangId = String(data.cabangId || data.branchId || "").trim();
          const name = String(data.name || data.nama || "").trim();
          const tipe = String(data.tipe || data.type || "Normal");
          const spp =
            Number(data.sppDefault ?? data.spp ?? data.nominalSpp ?? 0) || 0;

          return {
            id: d.id,
            name,
            cabangId,
            cabangNama: cabangId ? cabangNameById(cabangId) : "-",
            tipe,
            spp,
            active: data.active !== false,
          };
        });

        setSiswaAll(rows.filter((s) => s.active !== false));
      } catch (err) {
        console.log(err);
        Alert.alert("Gagal", "Tidak bisa mengambil data siswa.");
      } finally {
        setLoadingSiswa(false);
      }
    }

    loadSiswa();
  }, [cabang, cabangNameById]);

  // ===== list siswa sesuai filter cabang + search =====
  const list = useMemo(() => {
    let base = siswaAll;

    if (cabang !== "Semua") {
      base = base.filter((x) => x.cabangId === cabang);
    }

    const qq = q.trim().toLowerCase();
    if (!qq) return base;

    return base.filter((x) => x.name.toLowerCase().includes(qq));
  }, [siswaAll, cabang, q]);

  // ================= HITUNG SUDAH / BELUM BAYAR =================
  // ✅ Samakan logika dengan admin/riwayat.tsx: pakai monthKey + active students
  useEffect(() => {

    // ✅ Query siswa: ambil semua siswa cabang, filter active client-side (SAMA dengan riwayat)
    const qStudents =
      cabang === "Semua"
        ? query(collection(db, "students"))
        : query(collection(db, "students"), where("branchId", "==", cabang));

    const [yStr, mStr] = appliedMonthKey.split("-");
    const pYear = parseInt(yStr, 10);
    const pMonth = parseInt(mStr, 10) - 1;
    const startOfMonth = new Date(pYear, pMonth, 1, 0, 0, 0, 0);
    const endOfMonth = new Date(pYear, pMonth + 1, 0, 23, 59, 59, 999);

    // ✅ Query payments: pakai paidAt (SAMA dengan dashboard)
    // Hindari composite index error dengan tidak menggunakan where("branchId", "==", cabang)
    const qPayments = query(
      collection(db, "payments"),
      where("paidAt", ">=", Timestamp.fromDate(startOfMonth)),
      where("paidAt", "<=", Timestamp.fromDate(endOfMonth))
    );

    const unsubStudents = onSnapshot(qStudents, (studentSnap) => {
      const activeStudents: Student[] = studentSnap.docs
        .filter((d) => d.data()?.active !== false)
        .map((d) => {
          const data = d.data() as any;

          const cabangId = String(data.cabangId || data.branchId || "").trim();

          return {
            id: d.id.trim(),
            name: String(data.name || data.nama || "").trim(),
            cabangId,
            cabangNama: cabangId ? cabangNameById(cabangId) : "-",
            tipe: String(data.tipe || data.type || "Normal"),
            spp:
              Number(data.sppDefault ?? data.spp ?? data.nominalSpp ?? 0) || 0,
            active: data.active !== false,
          };
        });

      const unsubPayments = onSnapshot(qPayments, (paySnap) => {
        const paidIds = new Set<string>();
        let total = 0;

        paySnap.docs.forEach((d) => {
          const data = d.data() as any;

          // ✅ Filter cabang di client side untuk menghindari error index Firebase
          if (cabang !== "Semua" && data.branchId !== cabang) {
            return;
          }

          if (data.status === "DELETED") return; // Abaikan yang sudah dihapus

          // ✅ Sama seperti riwayat
          if (data.studentId) {
            paidIds.add(String(data.studentId));
          }
          total += Number(data.totalBayar || 0);
        });

        // ✅ HITUNG SAMA PERSIS DENGAN RIWAYAT:
        // sudahBayarCount = paidIds.size
        // belumBayarCount = Math.max(totalStudents - paidIds.size, 0)
        const totalStudents = activeStudents.length;

        // List siswa untuk tampilan tab terbayar/belum
        const sudah = activeStudents.filter((s) =>
          paidIds.has(String(s.id).trim()),
        );
        const belum = activeStudents.filter(
          (s) => !paidIds.has(String(s.id).trim()),
        );

        // Update KPI summary (pakai paidIds.size, BUKAN sudah.length)
        setSummary({
          totalMasuk: total,
          bayar: paidIds.size,
          belum: Math.max(totalStudents - paidIds.size, 0),
          totalSiswa: totalStudents,
        });
        setLoadingKpi(false);

        setSudahBayar(sudah);
        setBelumBayar(belum);
        setTotalNominalRange(total);
      });

      return () => unsubPayments();
    });

    return () => unsubStudents();
  }, [cabang, appliedMonthKey, cabangNameById]);

  // ===================== LOAD MUTASI (payments) saat pilih siswa =====================
  useEffect(() => {
    setHistory([]);
    if (!selected?.id) return;

    setLoadingHistory(true);

    const baseCol = collection(db, "payments");

    const qPay =
      cabang === "Semua"
        ? query(
            baseCol,
            where("studentId", "==", selected.id),
            orderBy("paidAt", "desc"),
            limit(60),
          )
        : query(
            baseCol,
            where("studentId", "==", selected.id),
            where("branchId", "==", cabang),
            orderBy("paidAt", "desc"),
            limit(60),
          );

    const unsub = onSnapshot(
      qPay,
      (snap) => {
        const rows: PaidRow[] = snap.docs.map((d) => {
          const data = d.data() as any;

          const paidAt: Date | null = data?.paidAt?.toDate
            ? data.paidAt.toDate()
            : data?.paidAt instanceof Timestamp
              ? data.paidAt.toDate()
              : null;

          const monthKey = String(data.monthKey || "");
          const bulan =
            String(data.monthLabel || "").trim() ||
            (monthKey
              ? monthLabelFromMonthKey(monthKey)
              : paidAt
                ? bulanIndo(paidAt)
                : "-");

          const nominal = Number(data.nominal || 0) || 0;
          const potongan = Number(data.potongan || 0) || 0;

          const total =
            Number(data.dibayar ?? data.totalBayar ?? data.total ?? 0) ||
            Math.max(nominal - potongan, 0);

          const metode: "Cash" | "Transfer" =
            String(data.metode || "Cash") === "Transfer" ? "Transfer" : "Cash";

          return {
            id: d.id,
            invoiceNo: data.invoiceNo || data.paymentGroupId || d.id, // 🔥 TAMBAHKAN INI
            monthKey: monthKey,
            status: data.status,
            bulan,
            tanggal: paidAt ? formatTanggal(paidAt) : "-",
            jam: paidAt ? formatJam(paidAt) : "-",
            nominal,
            potongan,
            dibayar: total,
            metode,

            proofDataUrl: data.proofDataUrl || null,
            proofType: (data.proofType as any) || null,
          };
        }).filter((row) => row.status !== "DELETED");

        setHistory(rows);
        setLoadingHistory(false);
      },
      (err: any) => {
        console.log("mutasi superadmin error:", err?.code, err?.message);
        setLoadingHistory(false);
      },
    );

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, cabang]);

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <LinearGradient
        colors={["#BFE9FF", "#EAF6FF", "#F7FBFF"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* ✅ MODAL DROPDOWN CABANG (tanpa ID) */}
      <Modal
        visible={cabangPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCabangPickerOpen(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setCabangPickerOpen(false)}
        />
        <View
          style={[styles.modalSheet, { paddingBottom: insets.bottom + 12 }]}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Pilih Unit</Text>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => setCabangPickerOpen(false)}
              style={styles.modalClose}
            >
              <Ionicons name="close" size={18} color="#0F172A" />
            </TouchableOpacity>
          </View>

          <View style={styles.modalSearchWrap}>
            <Ionicons name="search-outline" size={18} color="#64748B" />
            <TextInput
              value={cabangPickerSearch}
              onChangeText={setCabangPickerSearch}
              placeholder="Cari unit..."
              placeholderTextColor="#94A3B8"
              style={styles.modalSearchInput}
              autoCorrect={false}
            />
          </View>

          <ScrollView
            style={{ marginTop: 10, maxHeight: 380 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {loadingCabang ? (
              <Text style={styles.note}>Memuat unit...</Text>
            ) : cabangList.length <= 1 ? (
              <Text style={[styles.note, { color: "#ef4444" }]}>
                Belum ada unit. Tambah unit dulu.
              </Text>
            ) : cabangFiltered.length === 0 ? (
              <Text style={styles.note}>Unit tidak ditemukan.</Text>
            ) : (
              cabangFiltered.map((c) => {
                const active = c.id === cabang;
                return (
                  <TouchableOpacity
                    key={c.id}
                    activeOpacity={0.9}
                    style={[
                      styles.pickRow,
                      active && {
                        backgroundColor: "#DBEAFE",
                        borderColor: "#93C5FD",
                      },
                    ]}
                    onPress={() => {
                      setCabang(c.id);
                      setCabangPickerOpen(false);
                      setSelected(null);
                    }}
                  >
                    <Text
                      style={[
                        styles.pickRowText,
                        active && { color: "#0F172A" },
                      ]}
                    >
                      {c.nama}
                    </Text>

                    {active ? (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color="#16A34A"
                      />
                    ) : (
                      <Ionicons
                        name="chevron-forward"
                        size={18}
                        color="#94A3B8"
                      />
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>

          <Text style={[styles.note, { marginTop: 10 }]}>
            Tip: ketik nama unit biar cepat.
          </Text>
        </View>
      </Modal>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: Math.max(insets.top, 14),
            paddingBottom: tabH + insets.bottom + 18,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Header
          title="Siswa per unit"
          subtitle="Pilih unit, lalu klik siswa untuk lihat mutasi."
        />

        {/* Filter cabang */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Filter Unit</Text>

          {loadingCabang ? (
            <Text style={[styles.note, { marginTop: 10 }]}>Memuat unit...</Text>
          ) : cabangList.length <= 1 ? (
            <Text style={[styles.note, { marginTop: 10 }]}>
              Belum ada unit. Tambah unit dulu di fitur Tambah Unit.
            </Text>
          ) : (
            <>
              {/* ✅ dropdown cabang (tanpa ID) */}
              <TouchableOpacity
                activeOpacity={0.9}
                style={styles.selectBox}
                onPress={() => setCabangPickerOpen(true)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.selectLabel}>Unit Terpilih</Text>
                  <Text style={styles.selectValue}>{cabangLabel}</Text>
                </View>
                <Ionicons name="chevron-down" size={18} color="#64748B" />
              </TouchableOpacity>
            </>
          )}

          <View style={styles.inputWrap}>
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Cari nama siswa..."
              placeholderTextColor="#94A3B8"
              style={styles.input}
            />
            <View style={styles.rightIcon}>
              <Ionicons name="search-outline" size={18} color="#64748B" />
            </View>
          </View>
        </View>

        {/* List / Detail */}
        {!selected ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Daftar Siswa</Text>

            <View
              style={{
                marginTop: 12,
                backgroundColor: "#DBEAFE",
                borderRadius: 14,
                padding: 12,
              }}
            >
              <Text style={{ fontFamily: F.bold, color: "#1E40AF" }}>
                Total Masuk (Periode Dipilih)
              </Text>

              <Text
                style={{
                  marginTop: 6,
                  fontFamily: F.extrabold,
                  fontSize: 18,
                  color: "#0F172A",
                }}
              >
                Rp {totalNominalRange.toLocaleString("id-ID")}
              </Text>
            </View>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                style={[styles.selectBox, { flex: 1 }]}
                onPress={() => setShowFromPicker(true)}
                activeOpacity={0.9}
              >
                <Text style={styles.selectValue}>
                  Bulan: {bulanIndo(fromDate)}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={applyMonthFilter}
                style={{
                  flex: 1,
                  backgroundColor: "#2563EB",
                  borderRadius: 16,
                  paddingVertical: 14,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    color: "#FFFFFF",
                    fontFamily: F.extrabold,
                    fontSize: 14,
                  }}
                >
                  Terapkan
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.9}
                onPress={handleExportExcel}
                style={{
                  flex: 1,
                  backgroundColor: "#10B981",
                  borderRadius: 16,
                  paddingVertical: 14,
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "row",
                  gap: 6
                }}
              >
                <Ionicons name="download-outline" size={18} color="#FFFFFF" />
                <Text
                  style={{
                    color: "#FFFFFF",
                    fontFamily: F.extrabold,
                    fontSize: 14,
                  }}
                >
                  Export Excel
                </Text>
              </TouchableOpacity>
            </View>

            {/* ===== TAB TERBAYAR / BELUM ===== */}
            <View style={styles.segmentWrap}>
              <TouchableOpacity
                onPress={() => setFilterMode("terbayar")}
                style={[
                  styles.segmentBtn,
                  filterMode === "terbayar" && styles.segmentActiveBlue,
                ]}
              >
                <Text style={styles.segmentText}>
                  Terbayar ({sudahBayar.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setFilterMode("belum")}
                style={[
                  styles.segmentBtn,
                  filterMode === "belum" && styles.segmentActiveRed,
                ]}
              >
                <Text style={styles.segmentText}>
                  Belum ({belumBayar.length})
                </Text>
              </TouchableOpacity>
            </View>

            <View style={{ marginTop: 12, gap: 10 }}>
              {loadingSiswa ? (
                <Text style={styles.note}>Memuat siswa...</Text>
              ) : (
                (() => {
                  const baseData =
                    filterMode === "terbayar" ? sudahBayar : belumBayar;

                  const qq = q.trim().toLowerCase();

                  const dataToShow = !qq
                    ? baseData
                    : baseData.filter((s) => s.name.toLowerCase().includes(qq));

                  if (dataToShow.length === 0) {
                    return (
                      <Text style={styles.note}>
                        Tidak ada siswa untuk kategori ini.
                      </Text>
                    );
                  }

                  return dataToShow.map((s) => (
                    <TouchableOpacity
                      key={s.id}
                      activeOpacity={0.9}
                      style={styles.item}
                      onPress={() => setSelected(s)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemTitle}>{s.name}</Text>
                        <Text style={styles.itemSub}>
                          {s.cabangNama} • {s.tipe} • Rp{" "}
                          {s.spp.toLocaleString("id-ID")}
                        </Text>
                      </View>
                      <Ionicons
                        name="chevron-forward"
                        size={22}
                        color="#94A3B8"
                      />
                    </TouchableOpacity>
                  ));
                })()
              )}
            </View>

            <Text style={styles.note}>
              Klik siswa untuk lihat mutasi pembayaran (realtime).
            </Text>
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.cardTitle}>Mutasi Pembayaran</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Lunas</Text>
              </View>
            </View>

            <Text style={styles.bigName}>{selected.name}</Text>
            <Text style={styles.meta}>
              {selected.cabangNama} • {selected.tipe} • SPP Rp{" "}
              {selected.spp.toLocaleString("id-ID")}
            </Text>

            <View style={styles.hr} />

            {loadingHistory ? (
              <View style={{ paddingVertical: 10, alignItems: "center" }}>
                <ActivityIndicator />
                <Text style={[styles.note, { marginTop: 10 }]}>
                  Memuat mutasi...
                </Text>
              </View>
            ) : history.length === 0 ? (
              <Text style={[styles.note, { marginTop: 4 }]}>
                Belum ada pembayaran tersimpan untuk siswa ini.
              </Text>
            ) : (
              <View style={{ gap: 10 }}>
                {history.map((m) => {
                  const hasProof = !!m.proofDataUrl;
                  return (
                    <TouchableOpacity
                      key={m.id}
                      activeOpacity={0.9}
                      onPress={() => (hasProof ? openPreview(m) : null)}
                      style={styles.mutasiItem}
                    >
                      <View style={styles.rowBetween}>
                        <Text style={styles.mutasiBulan}>{m.bulan}</Text>
                        <Text style={styles.mutasiTanggal}>
                          {m.tanggal}
                          {m.jam !== "-" ? ` • ${m.jam}` : ""}
                        </Text>
                      </View>

                      <View style={styles.mutasiRow}>
                        <Text style={styles.k}>Nominal</Text>
                        <Text style={styles.v}>
                          Rp {m.nominal.toLocaleString("id-ID")}
                        </Text>
                      </View>
                      <View style={styles.mutasiRow}>
                        <Text style={styles.k}>Potongan Spin</Text>
                        <Text style={styles.v}>
                          Rp {m.potongan.toLocaleString("id-ID")}
                        </Text>
                      </View>
                      <View style={styles.mutasiRow}>
                        <Text style={styles.k}>Dibayar</Text>
                        <Text style={styles.vStrong}>
                          Rp {m.dibayar.toLocaleString("id-ID")}
                        </Text>
                      </View>
                      <View style={styles.mutasiRow}>
                        <Text style={styles.k}>Metode</Text>
                        <Text style={styles.v}>{m.metode}</Text>
                      </View>

                      <View
                        style={{
                          marginTop: 10,
                          flexDirection: "row",
                          gap: 10,
                          alignItems: "center",
                        }}
                      >
                        {hasProof ? (
                          <>
                            <Image
                              source={{ uri: m.proofDataUrl as string }}
                              style={styles.thumb}
                            />
                            <Text style={styles.proofHint}>
                              Tap untuk lihat bukti
                            </Text>
                          </>
                        ) : (
                          <View style={styles.thumbEmpty}>
                            <Ionicons
                              name="image-outline"
                              size={18}
                              color="#94A3B8"
                            />
                          </View>
                        )}
                      </View>

                      <TouchableOpacity
                        onPress={() => openEdit(m)}
                        style={{
                          marginTop: 10,
                          backgroundColor: "#DBEAFE",
                          paddingVertical: 6,
                          borderRadius: 10,
                          alignItems: "center",
                        }}
                      >
                        <Text
                          style={{ fontFamily: F.extrabold, color: "#1E40AF" }}
                        >
                          Edit Pembayaran
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDelete(m)}
                        style={{
                          marginTop: 6,
                          backgroundColor: "#FEE2E2",
                          paddingVertical: 6,
                          borderRadius: 10,
                          alignItems: "center",
                        }}
                      >
                        <Text
                          style={{ fontFamily: F.extrabold, color: "#DC2626" }}
                        >
                          Hapus Transaksi
                        </Text>
                      </TouchableOpacity>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.backBtn}
              onPress={() => {
                setSelected(null);
                setHistory([]);
              }}
            >
              <Ionicons name="arrow-back" size={18} color="#0F172A" />
              <Text style={styles.backText}>Kembali</Text>
            </TouchableOpacity>

            <Text style={styles.note}>
              * Data mutasi diambil realtime dari koleksi payments.
            </Text>
          </View>
        )}

        <View style={{ height: Platform.OS === "ios" ? 8 : 16 }} />
      </ScrollView>

      {/* ✅ MODAL PREVIEW BUKTI */}
      <Modal
        visible={previewOpen}
        transparent
        animationType="fade"
        onRequestClose={closePreview}
      >
        <View style={styles.previewBackdrop}>
          <View style={styles.previewCard}>
            <View style={styles.rowBetween}>
              <Text style={styles.modalTitle}>Bukti Pembayaran</Text>
              <TouchableOpacity onPress={closePreview} style={styles.xBtn}>
                <Ionicons name="close" size={18} color="#0F172A" />
              </TouchableOpacity>
            </View>

            {!previewItem?.proofDataUrl ? (
              <Text style={[styles.note, { marginTop: 12 }]}>
                Tidak ada bukti.
              </Text>
            ) : (
              <>
                <View style={{ marginTop: 12 }}>
                  <Image
                    source={{ uri: previewItem.proofDataUrl }}
                    style={styles.previewImg}
                  />
                </View>

                <View style={styles.previewMeta}>
                  <Text style={styles.previewMetaText}>
                    <Text style={{ fontFamily: F.extrabold }}>
                      {selected?.name || "-"}
                    </Text>
                    {"\n"}
                    {previewItem.bulan} • {previewItem.metode}
                    {"\n"}
                    {previewItem.tanggal}
                    {previewItem.jam !== "-" ? ` • ${previewItem.jam}` : ""}
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={editOpen} transparent animationType="fade">
        <View style={styles.previewBackdrop}>
          <View style={styles.previewCard}>
            <View style={styles.rowBetween}>
              <Text style={styles.modalTitle}>Edit Pembayaran</Text>
              <TouchableOpacity onPress={closeEdit} style={styles.xBtn}>
                <Ionicons name="close" size={18} color="#0F172A" />
              </TouchableOpacity>
            </View>

            <Text style={styles.note}>Periode: {editBulan}</Text>

            <Text style={{ marginTop: 10, fontFamily: F.bold }}>Nominal</Text>
            <TextInput
              value={editNominal}
              onChangeText={(t) => {
                const clean = t.replace(/[^0-9]/g, "");
                setEditNominal(formatRupiahInput(clean));
              }}
              keyboardType="numeric"
              style={styles.selectBox}
            />

            <Text style={{ marginTop: 10, fontFamily: F.bold }}>Potongan</Text>
            <TextInput
              value={editPotongan}
              onChangeText={(t) => setEditPotongan(formatRupiahInput(t))}
              keyboardType="numeric"
              style={styles.selectBox}
            />

            <Text style={{ marginTop: 10, fontFamily: F.bold }}>Tanggal</Text>
            <TouchableOpacity
              style={styles.selectBox}
              onPress={() => setShowEditDatePicker(true)}
            >
              <Text style={styles.selectValue}>{editTanggal}</Text>
            </TouchableOpacity>

            {showEditDatePicker && (
              <DateTimePicker
                value={
                  editTanggal
                    ? (() => {
                        const [dd, mm, yyyy] = editTanggal.split("-");
                        return new Date(
                          Number(yyyy),
                          Number(mm) - 1,
                          Number(dd),
                        );
                      })()
                    : new Date()
                }
                mode="date"
                display="default"
                onChange={(e, date) => {
                  setShowEditDatePicker(false);
                  if (date) {
                    setEditTanggal(formatTanggal(date));
                    setEditJam(formatJam(date));
                  }
                }}
              />
            )}

            <Text style={{ marginTop: 10, fontFamily: F.bold }}>Metode</Text>

            <View style={styles.segmentWrap}>
              <TouchableOpacity
                onPress={() => setEditMetode("Cash")}
                style={[
                  styles.segmentBtn,
                  editMetode === "Cash" && styles.segmentActiveBlue,
                ]}
              >
                <Text style={styles.segmentText}>Cash</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setEditMetode("Transfer")}
                style={[
                  styles.segmentBtn,
                  editMetode === "Transfer" && styles.segmentActiveBlue,
                ]}
              >
                <Text style={styles.segmentText}>Transfer</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={handleSaveEdit}
              style={{
                marginTop: 16,
                backgroundColor: "#16A34A",
                paddingVertical: 14,
                borderRadius: 16,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#fff", fontFamily: F.extrabold }}>
                Simpan Perubahan
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* FROM DATE PICKER */}
      {showFromPicker && (
        <DateTimePicker
          value={fromDate}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowFromPicker(false);
            if (selectedDate) {
              setFromDate(selectedDate);
              setSelectedMonthKey(monthKeyFromDate(selectedDate));
            }
          }}
        />
      )}
    </SafeAreaView>
  );
}

// ================= KPI BOX COMPONENT =================
function KpiBox({
  label,
  value,
  loading,
  money,
}: {
  label: string;
  value: any;
  loading: boolean;
  money?: boolean;
}) {
  return (
    <View style={styles.kpiBox}>
      <Text style={styles.kpiSmallLabel}>{label}</Text>
      {loading ? (
        <ActivityIndicator size="small" />
      ) : (
        <Text
          style={[styles.kpiSmallValue, money && { fontSize: 15 }]}
          numberOfLines={1}
        >
          {value}
        </Text>
      )}
    </View>
  );
}

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.brand}>SPP Mobile</Text>
        <View style={styles.chip}>
          <Text style={styles.chipText}>Master</Text>
        </View>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

// ✅ styles kamu biarkan sama persis + tambah style dropdown/modal (tidak mengubah yang lain)
const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 24, gap: 12 },

  // ===== KPI STYLES =====
  kpiMain: {
    backgroundColor: "#0EA5E9",
    borderRadius: 20,
    padding: 16,
  },
  kpiLabel: {
    fontFamily: F.semibold,
    fontSize: 12,
    color: "#E0F2FE",
  },
  kpiValue: {
    marginTop: 8,
    fontFamily: F.extrabold,
    fontSize: 26,
    color: "#FFFFFF",
  },
  kpiGrid: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: 8,
  },
  kpiBox: {
    width: "48.6%",
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.95)",
  },
  kpiSmallLabel: {
    fontFamily: F.semibold,
    fontSize: 12,
    color: "#64748B",
  },
  kpiSmallValue: {
    marginTop: 6,
    fontFamily: F.extrabold,
    fontSize: 18,
    color: "#0F172A",
  },

  header: {
    paddingHorizontal: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: { fontFamily: F.extrabold, color: "#1D4ED8", letterSpacing: 0.3 },
  chip: {
    backgroundColor: "rgba(219,234,254,0.95)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(191,219,254,1)",
  },
  chipText: { color: "#1E40AF", fontFamily: F.extrabold, fontSize: 12 },

  title: {
    fontSize: 26,
    fontFamily: F.extrabold,
    color: "#0F172A",
    marginTop: 10,
  },
  subtitle: {
    color: "#64748B",
    lineHeight: 20,
    fontFamily: F.semibold,
    marginTop: 2,
  },

  card: {
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.95)",
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
  cardTitle: { fontSize: 16, fontFamily: F.extrabold, color: "#0F172A" },

  // ✅ dropdown select box
  selectBox: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  selectLabel: {
    fontFamily: F.semibold,
    color: "#94A3B8",
    fontSize: 12,
    marginBottom: 2,
  },
  selectValue: { fontFamily: F.extrabold, color: "#0F172A", fontSize: 14 },

  inputWrap: {
    marginTop: 12,
    position: "relative",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingLeft: 12,
    paddingRight: 42,
    height: 48,
    justifyContent: "center",
  },
  input: { fontSize: 14, color: "#0F172A", fontFamily: F.semibold },
  rightIcon: {
    position: "absolute",
    right: 12,
    height: 48,
    width: 30,
    alignItems: "center",
    justifyContent: "center",
  },

  item: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 18,
    padding: 12,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  itemTitle: { fontFamily: F.extrabold, color: "#0F172A", fontSize: 15 },
  itemSub: { marginTop: 4, color: "#64748B", fontFamily: F.semibold },

  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  badge: {
    backgroundColor: "#DCFCE7",
    borderColor: "#BBF7D0",
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeText: { fontFamily: F.extrabold, fontSize: 12, color: "#0F172A" },

  bigName: {
    marginTop: 10,
    fontFamily: F.extrabold,
    color: "#0F172A",
    fontSize: 18,
  },
  meta: { marginTop: 6, color: "#64748B", fontFamily: F.bold },

  hr: {
    height: 1,
    backgroundColor: "rgba(226,232,240,0.95)",
    marginTop: 12,
    marginBottom: 12,
  },

  mutasiItem: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 18,
    padding: 12,
  },
  mutasiBulan: { fontFamily: F.extrabold, color: "#0F172A" },
  mutasiTanggal: { fontFamily: F.bold, color: "#94A3B8" },
  mutasiRow: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  k: { color: "#64748B", fontFamily: F.bold },
  v: { color: "#0F172A", fontFamily: F.extrabold },
  vStrong: { color: "#0F172A", fontFamily: F.extrabold },

  thumb: {
    width: 52,
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F1F5F9",
  },
  thumbEmpty: {
    width: 52,
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
  },
  proofHint: { color: "#94A3B8", fontFamily: F.bold },

  backBtn: {
    marginTop: 14,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 12,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  backText: { color: "#0F172A", fontFamily: F.extrabold },

  note: {
    marginTop: 12,
    textAlign: "center",
    color: "#94A3B8",
    fontFamily: F.semibold,
    fontSize: 12,
  },

  // ✅ modal dropdown
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,23,42,0.35)",
  },
  modalSheet: {
    position: "absolute",
    left: 14,
    right: 14,
    top: 120,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.95)",
    padding: 14,
    shadowColor: "#0F172A",
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 10,
  },
  modalTitle: { fontSize: 16, fontFamily: F.extrabold, color: "#0F172A" },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: "rgba(226,232,240,0.8)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalSearchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 12,
    height: 46,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 14,
    color: "#0F172A",
    fontFamily: F.semibold,
  },
  pickRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    marginBottom: 10,
  },
  pickRowText: { fontFamily: F.extrabold, color: "#0F172A", fontSize: 14 },

  // ✅ preview modal
  previewBackdrop: {
    flex: 1,
    backgroundColor: "rgba(2,6,23,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  previewCard: {
    width: "100%",
    maxWidth: 430,
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.95)",
  },
  modalTitle2: { fontSize: 16, fontFamily: F.extrabold, color: "#0F172A" },
  xBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "rgba(226,232,240,0.8)",
    alignItems: "center",
    justifyContent: "center",
  },
  previewImg: {
    width: "100%",
    height: 360,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F1F5F9",
  },
  previewMeta: {
    marginTop: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    padding: 10,
  },

  // ===== SEGMENT TAB =====
  segmentWrap: {
    marginTop: 14,
    flexDirection: "row",
    gap: 10,
  },

  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
  },

  segmentActiveBlue: {
    backgroundColor: "#DBEAFE",
  },

  segmentActiveRed: {
    backgroundColor: "#FEE2E2",
  },

  segmentText: {
    fontFamily: F.extrabold,
    color: "#0F172A",
  },

  previewMetaText: { color: "#0F172A", fontFamily: F.bold, lineHeight: 18 },

  // // keep old key used in preview header
  // modalTitle: { fontSize: 16, fontFamily: F.extrabold, color: "#0F172A" },
});

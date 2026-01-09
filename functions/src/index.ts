import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();

function normalizeUsername(u: string) {
  return String(u || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

export const createBranchAdmin = functions.https.onCall(
  async (data: any, context: any) => {
    // 1) harus login
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Harus login.");
    }

    const superUid = context.auth.uid;

    // 2) cek role SUPERADMIN dari Firestore users/{uid}
    const meSnap = await admin.firestore().doc(`users/${superUid}`).get();
    if (!meSnap.exists || meSnap.data()?.role !== "SUPERADMIN") {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Bukan SUPERADMIN."
      );
    }

    const nama = String(data?.nama || "").trim();
    const usernameRaw = String(data?.username || "").trim();
    const password = String(data?.password || "");
    const cabangId = String(data?.cabangId || "").trim();

    if (!nama || !usernameRaw || !password || !cabangId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Data tidak lengkap."
      );
    }

    if (password.length < 6) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Password minimal 6 karakter."
      );
    }

    const username = normalizeUsername(usernameRaw);
    if (username.length < 3) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Username minimal 3 karakter."
      );
    }

    // 3) pastikan cabang ada di branches/{cabangId}
    const brSnap = await admin.firestore().doc(`branches/${cabangId}`).get();
    if (!brSnap.exists) {
      throw new functions.https.HttpsError(
        "not-found",
        "Cabang tidak ditemukan."
      );
    }

    // 4) email internal (user login pakai username, tapi auth pakai email internal)
    const email = `${username}@spp.local`;

    // 5) buat user Auth
    let userRecord: admin.auth.UserRecord;
    try {
      userRecord = await admin.auth().createUser({
        email,
        password,
        displayName: nama,
      });
    } catch (e: any) {
      const code = String(e?.code || "");
      const msg = String(e?.message || "");
      if (
        code.includes("email-already-exists") ||
        msg.includes("email-already-exists")
      ) {
        throw new functions.https.HttpsError(
          "already-exists",
          "Username sudah dipakai."
        );
      }
      throw new functions.https.HttpsError("internal", msg);
    }

    const newUid = userRecord.uid;

    // 6) simpan profile ke users/{uid}
    await admin.firestore().doc(`users/${newUid}`).set({
      role: "ADMIN",
      active: true,
      displayName: nama,
      username,
      cabangId,
      email, // internal
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: superUid,
    });

    // 7) simpan list admin cabang ke branch_admins/{uid}
    await admin.firestore().doc(`branch_admins/${newUid}`).set({
      uid: newUid,
      nama,
      username,
      cabangId,
      aktif: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: superUid,
    });

    return { ok: true, uid: newUid };
  }
);

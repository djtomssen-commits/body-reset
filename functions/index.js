const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

exports.countUserOnCreate =
functions.auth.user().onCreate(async (user) => {

  const ref =
    admin.firestore()
      .doc("stats/global");

  await admin.firestore()
    .runTransaction(async (tx) => {

      const snap =
        await tx.get(ref);

      const current =
        snap.exists
        ? (snap.data().usersCount || 0)
        : 0;

      tx.set(ref, {
        usersCount: current + 1
      }, { merge: true });

    });

});
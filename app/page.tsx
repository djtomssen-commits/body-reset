export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center text-center px-6">

      <h1 className="text-5xl font-bold text-gray-900 mb-4">
        Body Reset
      </h1>

      <p className="text-2xl text-gray-600 mb-6">
        Reset deinen Körper.
      </p>

      <p className="text-lg text-gray-500 max-w-xl mb-8">
        Struktur. Disziplin. Veränderung.
        Verfolge deine Kalorien, dein Training und deinen Fortschritt – alles an einem Ort.
      </p>

      <a href="/login">
  <button className="bg-green-600 hover:bg-green-700 text-white px-8 py-4 rounded-xl text-lg font-semibold transition">
    Jetzt starten
  </button>
</a>

    </main>
  );
}


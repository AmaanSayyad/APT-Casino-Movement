"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";

export default function GameHistoryRedirect() {
  return (
    <div className="min-h-screen bg-[#070005] text-white flex flex-col items-center justify-center px-4">
      <h1 className="text-2xl font-semibold mb-3">Game History is available</h1>
      <p className="text-gray-300 mb-6 text-center max-w-md">
        Please navigate to the history page to view your full game history.
      </p>
      <Link
        href="/history"
        className="px-4 py-2 rounded-lg bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 transition-colors"
      >
        Go to History
      </Link>
    </div>
  );
}




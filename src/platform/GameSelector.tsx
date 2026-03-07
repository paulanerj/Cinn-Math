import React, { useState } from 'react';

type GameId = 'combine-grid' | 'speed-grid';

interface GameCardProps {
  id: GameId;
  title: string;
  desc: string;
  emoji: string;
  onSelect: (id: GameId) => void;
}

function GameCard({ id, title, desc, emoji, onSelect }: GameCardProps) {
  return (
    <button
      onClick={() => onSelect(id)}
      className="flex flex-col items-center gap-3 bg-white rounded-2xl shadow-md p-6 w-full max-w-xs
                 border-2 border-transparent hover:border-indigo-400 active:scale-95 transition-all"
    >
      <span className="text-5xl">{emoji}</span>
      <span className="text-xl font-bold text-gray-800">{title}</span>
      <span className="text-sm text-gray-500 text-center">{desc}</span>
    </button>
  );
}

export default function GameSelector() {
  const [activeGame, setActiveGame] = useState<GameId | null>(null);

  if (activeGame === 'combine-grid') {
    // Lazy-load CombineGrid
    const CombineGrid = React.lazy(() => import('../games/combine-grid/App'));
    return (
      <React.Suspense fallback={<Loading />}>
        <CombineGrid onBack={() => setActiveGame(null)} />
      </React.Suspense>
    );
  }

  if (activeGame === 'speed-grid') {
    const SpeedGridGame = React.lazy(() => import('../games/speed-grid/ui/SpeedGridGame'));
    return (
      <React.Suspense fallback={<Loading />}>
        <SpeedGridGame onBack={() => setActiveGame(null)} />
      </React.Suspense>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100 flex flex-col items-center justify-center p-6 gap-8">
      <div className="text-center">
        <h1 className="text-4xl font-extrabold text-indigo-700 mb-2">Cinn Math</h1>
        <p className="text-gray-500 text-sm">Choose your game</p>
      </div>
      <div className="flex flex-col sm:flex-row gap-5 w-full items-center justify-center">
        <GameCard
          id="combine-grid"
          title="Combine Grid"
          desc="Clear tiles by finding factor pairs. Beat the board!"
          emoji="🧮"
          onSelect={setActiveGame}
        />
        <GameCard
          id="speed-grid"
          title="Speed Grid"
          desc="Chain tiles to hit the target before time runs out!"
          emoji="⚡"
          onSelect={setActiveGame}
        />
      </div>
    </div>
  );
}

function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center text-gray-400 text-lg">
      Loading...
    </div>
  );
}

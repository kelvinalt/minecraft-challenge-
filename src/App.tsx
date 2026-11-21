/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { GameProvider, useGame } from './frontend/state/GameStore';
import { MainMenu } from './frontend/components/MainMenu';
import { WorldSelectScreen } from './frontend/components/WorldSelectScreen';
import { LoadingScreen } from './frontend/components/LoadingScreen';
import { SettingsMenu } from './frontend/components/SettingsMenu';
import { GameViewport } from './frontend/components/GameViewport';

const AppRouter: React.FC = () => {
  const { screen, activeWorld } = useGame();

  if (screen === 'main_menu') {
    return <MainMenu />;
  }

  if (screen === 'world_select') {
    return <WorldSelectScreen />;
  }

  if (screen === 'loading') {
    return <LoadingScreen />;
  }

  if (screen === 'settings' && !activeWorld) {
    return <SettingsMenu />;
  }

  return <GameViewport />;
};

export default function App() {
  return (
    <GameProvider>
      <main className="w-full h-full overflow-hidden">
        <AppRouter />
      </main>
    </GameProvider>
  );
}

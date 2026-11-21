import React from 'react';
import { soundFX } from '../engine/SoundFX';
import { DEFAULT_SETTINGS, useGame } from '../state/GameStore';

export const SettingsMenu: React.FC = () => {
  const { settings, updateSettings, returnScreen, setScreen } = useGame();

  const click = (fn: () => void) => {
    soundFX.playClick();
    fn();
  };

  return (
    <div
      className={`w-full h-full flex flex-col items-center justify-center p-4 sm:p-8 ${
        returnScreen === 'main_menu' ? 'mc-dirt-bg' : 'fixed inset-0 z-50 bg-black/75'
      }`}
    >
      <div className="mc-dark-panel w-full max-w-2xl p-6 sm:p-7 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-white/15 pb-3 mb-5">
          <div>
            <h2 className="font-pixel text-xl text-white">Options</h2>
            <p className="text-xs text-stone-400 font-ui mt-0.5">
              Graphics, controls, and audio preferences
            </p>
          </div>
          <button
            type="button"
            onClick={() => click(() => updateSettings(DEFAULT_SETTINGS))}
            className="mc-btn px-3 py-1.5 text-xs"
          >
            Reset Defaults
          </button>
        </div>

        <div className="overflow-y-auto mc-scroll pr-2 space-y-5 flex-1">
          {/* Sliders */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-black/35 border border-white/10 p-3.5">
              <div className="flex justify-between text-xs font-pixel text-stone-200 mb-2">
                <span>Field of View (FOV)</span>
                <span className="font-mono-tabular text-amber-300">{settings.fov}°</span>
              </div>
              <input
                type="range"
                min={60}
                max={105}
                value={settings.fov}
                onChange={(e) => updateSettings({ fov: Number(e.target.value) })}
                className="w-full accent-[#67a93f]"
              />
            </div>

            <div className="bg-black/35 border border-white/10 p-3.5">
              <div className="flex justify-between text-xs font-pixel text-stone-200 mb-2">
                <span>Render Distance</span>
                <span className="font-mono-tabular text-amber-300">
                  {settings.renderDistance} chunks
                </span>
              </div>
              <input
                type="range"
                min={2}
                max={6}
                value={settings.renderDistance}
                onChange={(e) => updateSettings({ renderDistance: Number(e.target.value) })}
                className="w-full accent-[#67a93f]"
              />
            </div>

            <div className="bg-black/35 border border-white/10 p-3.5">
              <div className="flex justify-between text-xs font-pixel text-stone-200 mb-2">
                <span>Mouse Sensitivity</span>
                <span className="font-mono-tabular text-amber-300">
                  {Math.round(settings.mouseSensitivity * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0.3}
                max={2.0}
                step={0.1}
                value={settings.mouseSensitivity}
                onChange={(e) => updateSettings({ mouseSensitivity: Number(e.target.value) })}
                className="w-full accent-[#67a93f]"
              />
            </div>

            <div className="bg-black/35 border border-white/10 p-3.5">
              <div className="flex justify-between text-xs font-pixel text-stone-200 mb-2">
                <span>Master Sound</span>
                <span className="font-mono-tabular text-amber-300">
                  {Math.round(settings.masterVolume * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.masterVolume}
                onChange={(e) => updateSettings({ masterVolume: Number(e.target.value) })}
                className="w-full accent-[#67a93f]"
              />
            </div>
          </div>

          {/* Toggles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              {
                key: 'showDebugHud' as const,
                label: 'Debug Info (F3)',
                value: settings.showDebugHud,
              },
              {
                key: 'showControlsHint' as const,
                label: 'Controls Legend',
                value: settings.showControlsHint,
              },
              {
                key: 'shadowsEnabled' as const,
                label: 'Sun Shadows',
                value: settings.shadowsEnabled,
              },
              {
                key: 'invertY' as const,
                label: 'Invert Y-Axis',
                value: settings.invertY,
              },
              {
                key: 'touchControls' as const,
                label: 'On-Screen Controls',
                value: settings.touchControls,
              },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => click(() => updateSettings({ [item.key]: !item.value }))}
                className="mc-btn py-2.5 px-4 text-xs flex items-center justify-between"
              >
                <span>{item.label}</span>
                <span className={item.value ? 'text-[#a3ff7a]' : 'text-stone-400'}>
                  {item.value ? 'ON' : 'OFF'}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="pt-5 border-t border-white/15 mt-5 flex justify-center">
          <button
            type="button"
            onClick={() => click(() => setScreen(returnScreen))}
            className="mc-btn mc-btn-primary px-10 py-2.5 text-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

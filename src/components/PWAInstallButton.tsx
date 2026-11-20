import React, { useState } from 'react';
import { Download, Smartphone, WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="inline-flex items-center gap-2 rounded-xl border border-[#D8D0E4] bg-[#EDE8F5] px-3.5 py-2 text-xs font-semibold text-[#4B3D63] transition-colors hover:bg-[#E1D8EE] whitespace-nowrap shrink-0 min-h-[40px]"
        title="Install PixelYarn on your device for offline use"
      >
        <Download className="h-4 w-4" />
        <span>{compact ? 'Install' : 'Install App'}</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-[#E6E0D4] bg-white px-3.5 py-2 text-xs font-semibold text-[#3C3844] transition-colors hover:bg-[#F3EFE7] whitespace-nowrap shrink-0 min-h-[40px]"
        >
          <Smartphone className="h-4 w-4 text-[#7C6A9A]" />
          <span>Install App</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
            <div className="w-full max-w-sm rounded-2xl border border-[#E6E0D4] bg-[#FAF7F2] p-6 shadow-xl">
              <h3 className="font-display text-lg font-bold text-[#1E1D20]">
                Install PixelYarn on iOS
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#524D59]">
                1. Tap the <strong>Share</strong> button in your Safari toolbar.
                <br />
                2. Scroll down and select <strong>Add to Home Screen</strong>.
                <br />
                3. Open PixelYarn from your Home Screen anytime, even offline.
              </p>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-xl bg-[#1F2024] py-2.5 text-sm font-semibold text-[#FAF7F2] hover:bg-[#2F3036] min-h-[44px]"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-20 left-4 z-40 flex items-center gap-2 rounded-xl border border-[#D49A2A]/40 bg-[#1F2024] px-3.5 py-2 text-xs font-medium text-[#FAF7F2] shadow-lg lg:bottom-4"
    >
      <WifiOff className="h-3.5 w-3.5 text-[#F5C451]" />
      <span>Offline Mode — Local projects saved on device</span>
    </div>
  );
};

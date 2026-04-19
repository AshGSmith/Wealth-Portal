'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';

export default function LegacyDataMigrationBanner() {
  const {
    legacyMigrationAvailable,
    legacyMigrationRequiresConfirmation,
    legacyMigrationInProgress,
    legacyMigrationRecordCount,
    importLegacyLocalData,
    dismissLegacyMigration,
  } = useStore();
  const [confirming, setConfirming] = useState(false);

  if (!legacyMigrationAvailable) return null;

  const showConfirmation = legacyMigrationRequiresConfirmation && confirming;

  return (
    <div className="border-b" style={{ background: '#eff6ff', borderColor: '#bfdbfe', color: '#1e3a8a' }}>
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-sm">
        <div className="min-w-0 flex-1">
          <p className="font-medium">
            Legacy local data found
          </p>
          <p className="text-xs sm:text-sm">
            Found {legacyMigrationRecordCount} locally stored record{legacyMigrationRecordCount === 1 ? '' : 's'} from an older app version.
            {legacyMigrationRequiresConfirmation
              ? ' Your account already has saved backend data, so importing will replace the records currently visible to you.'
              : ' Import it once to attach it to your signed-in account and keep it across domains and devices.'}
          </p>
          {showConfirmation && (
            <p className="mt-1 text-xs font-medium sm:text-sm">
              Confirm import to replace your current visible account data with the legacy local copy.
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showConfirmation ? (
            <button
              type="button"
              onClick={() => void importLegacyLocalData()}
              disabled={legacyMigrationInProgress}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white sm:text-sm"
              style={{ background: '#2563eb' }}
            >
              {legacyMigrationInProgress ? 'Importing…' : 'Confirm import'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (legacyMigrationRequiresConfirmation) {
                  setConfirming(true);
                  return;
                }
                void importLegacyLocalData();
              }}
              disabled={legacyMigrationInProgress}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white sm:text-sm"
              style={{ background: '#2563eb' }}
            >
              {legacyMigrationInProgress ? 'Importing…' : 'Import local data'}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setConfirming(false);
              dismissLegacyMigration();
            }}
            className="rounded-lg border px-3 py-1.5 text-xs font-semibold sm:text-sm"
            style={{ borderColor: '#93c5fd', color: '#1d4ed8' }}
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}

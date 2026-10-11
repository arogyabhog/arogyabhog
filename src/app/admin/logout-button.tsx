'use client';

import { logout } from '@/app/login/actions';

export function LogoutButton() {
  return (
    <button type="button" onClick={() => logout()} className="font-semibold text-ink-500 hover:text-forest-700">
      Sign out
    </button>
  );
}

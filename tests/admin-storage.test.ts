import { afterEach, describe, expect, it, vi } from 'vitest';
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
describe('admin storage failures', () => {
  it('keeps edits and previously saved data when quota is exceeded, then recovers', async () => {
    let saved = JSON.stringify({ log: ['saved'], classGroups: [] });
    let full = true;
    const dispatchEvent = vi.fn();
    vi.stubGlobal('window', { localStorage: { getItem: () => saved, setItem: (_key: string, value: string) => { if (full) throw new DOMException('Full', 'QuotaExceededError'); saved = value; } }, dispatchEvent });
    const store = await import('@/lib/mockStorage');
    expect(() => store.updateAdminStore({ log: ['new edit'] })).not.toThrow();
    expect(JSON.parse(saved).log).toEqual(['saved']);
    expect(store.readAdminStore().log).toEqual(['new edit']);
    expect(store.hasUnsavedAdminState()).toBe(true);
    store.updateAdminStore({ resources: [] });
    expect(store.readAdminStore().log).toEqual(['new edit']);
    full = false;
    store.updateAdminStore({ quests: [] });
    expect(store.hasUnsavedAdminState()).toBe(false);
    expect(JSON.parse(saved)).toMatchObject({ log: ['new edit'], resources: [], quests: [], classGroups: [] });
    expect(dispatchEvent).toHaveBeenCalledTimes(3);
  });
  it('handles blocked storage access without crashing', async () => {
    vi.stubGlobal('window', { get localStorage() { throw new DOMException('Blocked', 'SecurityError'); }, dispatchEvent: vi.fn() });
    const store = await import('@/lib/mockStorage');
    expect(store.readAdminStore()).toEqual({});
    expect(store.hasAdminSession()).toBe(false);
    expect(() => store.updateAdminStore({ log: ['still usable'] })).not.toThrow();
    expect(store.readAdminStore().log).toEqual(['still usable']);
  });
});

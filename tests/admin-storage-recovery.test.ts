import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/adminStorageBackup',()=>({archiveAdminStorage:vi.fn(),readAdminStorageArchive:vi.fn()}));
import { archiveAdminStorage, readAdminStorageArchive } from '@/lib/adminStorageBackup';
afterEach(()=>{vi.unstubAllGlobals();vi.resetModules();vi.clearAllMocks();});
function browser() {
  let saved=JSON.stringify({classGroups:[{id:'a',name:'Knights'}],resources:[{id:'resource'}],lichessActivitySnapshots:[{data:{games:'x'.repeat(100000)}}]});
  vi.stubGlobal('window',{localStorage:{getItem:()=>saved,setItem:(_k:string,v:string)=>{saved=v;}},dispatchEvent:vi.fn()});
  return ()=>saved;
}
describe('admin cache recovery',()=>{
  it('backs up before compacting, keeps concurrent edits and stops re-growing snapshots',async()=>{
    const saved=browser();const before=saved();
    let done!:()=>void;vi.mocked(archiveAdminStorage).mockImplementation(()=>new Promise<void>(resolve=>{done=resolve;}));
    const store=await import('@/lib/mockStorage');
    const recovery=store.recoverAdminStorage();
    expect(saved()).toBe(before);
    store.updateAdminStore({log:['edit during backup']});
    done();await recovery;
    const result=JSON.parse(saved());
    expect(archiveAdminStorage).toHaveBeenCalledWith(before,before);
    expect(result.classGroups[0].name).toBe('Knights');expect(result.resources).toHaveLength(1);
    expect(result.log).toEqual(['edit during backup']);expect(result.lichessActivitySnapshots).toBeUndefined();
    store.updateAdminStore({lichessActivitySnapshots:[{id:'new'} as never]});
    expect(JSON.parse(saved()).lichessActivitySnapshots).toBeUndefined();
    expect(saved().length).toBeLessThan(before.length/100);
  });
  it('does not discard existing data when the archive fails and allows retry',async()=>{
    const saved=browser();const before=saved();
    vi.mocked(archiveAdminStorage).mockRejectedValueOnce(new Error('Backup unavailable')).mockResolvedValueOnce();
    const store=await import('@/lib/mockStorage');
    await expect(store.recoverAdminStorage()).rejects.toThrow('Backup unavailable');
    expect(saved()).toBe(before);
    await store.recoverAdminStorage();expect(JSON.parse(saved()).lichessActivitySnapshots).toBeUndefined();
  });
  it('exports current edits and the immutable original archive together',async()=>{
    const saved=browser();
    const original={saved:'original saved JSON',current:'original in-memory JSON'};
    vi.mocked(readAdminStorageArchive).mockResolvedValue(original);
    const link={href:'',download:'',click:vi.fn(),remove:vi.fn()};
    vi.stubGlobal('document',{createElement:()=>link,body:{appendChild:vi.fn()}});
    const create=vi.spyOn(URL,'createObjectURL').mockReturnValue('blob:test-backup');
    vi.spyOn(URL,'revokeObjectURL').mockImplementation(()=>{});
    vi.useFakeTimers();
    try {
      const store=await import('@/lib/mockStorage');await store.downloadAdminBackup();
      const exported=JSON.parse(await (create.mock.calls[0][0] as Blob).text());
      expect(exported.state).toEqual(JSON.parse(saved()));expect(exported.originalArchive).toEqual(original);
      expect(link.download).toMatch(/^chessquest-teacher-backup-.*\.json$/);expect(link.click).toHaveBeenCalled();
      vi.runAllTimers();expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-backup');
    } finally {vi.useRealTimers();vi.restoreAllMocks();}
  });
});

import {afterEach, describe, expect, it} from 'vitest';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Storage, validateStorageKey} from './lib/storage';
import {decodeUpload} from './lib/mediaValidation';
const dirs:string[]=[];
afterEach(async()=>{for(const dir of dirs.splice(0)) await rm(dir,{recursive:true,force:true});});
describe('private media',()=>{
  it('rejects traversal and arbitrary public URL keys',()=>{
    for(const key of ['../secret','chat/u1/../../secret','https://example.org/file','avatar/u1/x']) expect(()=>validateStorageKey(key)).toThrow();
  });
  it('stores bytes privately and deletes bytes and metadata idempotently',async()=>{
    const dir=await mkdtemp(join(tmpdir(),'quick-chat-media-')); dirs.push(dir);
    const storage=new Storage(dir);
    const saved=await storage.uploadFile({fileName:'chat/u1/report.txt',fileContent:Buffer.from('private'),contentType:'application/octet-stream'});
    expect(saved.key).toMatch(/^chat\/u1\/[a-f0-9-]{36}$/);
    expect((await storage.readFile({fileKey:saved.key})).toString()).toBe('private');
    expect((await storage.listFiles()).objects).toHaveLength(1);
    await storage.deleteFile({fileKey:saved.key});
    await storage.deleteFile({fileKey:saved.key});
    await expect(storage.readFile({fileKey:saved.key})).rejects.toThrow();
    expect((await storage.listFiles()).objects).toHaveLength(0);
  });
  it('does not trust browser declared image or HTML MIME',()=>{
    expect(()=>decodeUpload(Buffer.from('<svg onload="alert(1)"/>').toString('base64'),'image/svg+xml')).toThrow();
    expect(decodeUpload(Buffer.from('<html>active</html>').toString('base64'),'text/html').contentType).toBe('application/octet-stream');
    expect(()=>decodeUpload('%%%')).toThrow();
  });
  it('detects supported image bytes independently of filename',()=>{
    expect(decodeUpload(Buffer.from('89504e470d0a1a0a00000000','hex').toString('base64'),'image/png').contentType).toBe('image/png');
  });
});

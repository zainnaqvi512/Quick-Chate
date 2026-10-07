import { useEffect, useState } from 'react';
import { getToken } from './auth';
import { apiUrl } from './apiUrl';

/** Private bytes are kept only in an object URL owned by this mounted viewer. */
export function usePrivateMedia(key: string | null | undefined) {
  const [state, setState] = useState<{key:string|null|undefined;url:string|null;loading:boolean}>({key:null,url:null,loading:false});
  useEffect(() => {
    if (!key) return;
    const abort = new AbortController();
    let objectUrl: string | null = null;
    let disposed = false;
    const token = getToken();
    fetch(apiUrl(`/api/media?key=${encodeURIComponent(key)}`), {headers:token?{Authorization:`Bearer ${token}`}:{},cache:'no-store',signal:abort.signal})
      .then(async response => {if(!response.ok) throw new Error('Unavailable'); return response.blob();})
      .then(blob => { if(disposed) return; objectUrl=URL.createObjectURL(blob); setState({key,url:objectUrl,loading:false}); })
      .catch(() => { if(!disposed) setState({key,url:null,loading:false}); });
    return () => {disposed=true;abort.abort();if(objectUrl) URL.revokeObjectURL(objectUrl);};
  }, [key]);
  return state.key===key?state:{url:null,loading:!!key};
}

import { afterEach, describe, expect, it, vi } from 'vitest';
import { beginOAuth } from './_core/loginStart';
import { decodeOAuthState, OAUTH_STATE_COOKIE } from '../shared/const';

function response() {
  const res:any={set:vi.fn(),status:vi.fn(),type:vi.fn(),send:vi.fn(),cookie:vi.fn(),redirect:vi.fn()};
  for(const name of ['set','status','type','send','cookie','redirect']) res[name].mockReturnValue(res);
  return res;
}
afterEach(()=>vi.unstubAllEnvs());
describe('server-side login start',()=>{
  it('redirects with a fresh cryptographic nonce and secure HTTP-only cookie without frontend config',()=>{
    vi.stubEnv('MANUS_PROJECT_ID','test-client');
    vi.stubEnv('MANUS_OAUTH_PORTAL_URL','https://auth.example');
    const res=response();
    beginOAuth({query:{origin:'https://tiflisi-staff.vercel.app'}} as never,res);
    const [status,target]=res.redirect.mock.calls[0];
    expect(status).toBe(302);
    const url=new URL(target);const state=decodeOAuthState(url.searchParams.get('state')!);
    expect(url.origin).toBe('https://auth.example');
    expect(state.redirectUri).toBe('https://tiflisi-staff.vercel.app/api/oauth/callback');
    expect(state.nonce).toMatch(/^[a-f0-9]{64}$/);
    expect(res.cookie).toHaveBeenCalledWith(OAUTH_STATE_COOKIE,state.nonce,expect.objectContaining({httpOnly:true,secure:true,sameSite:'none',path:'/',maxAge:600000}));
  });
  it('rejects arbitrary callback origins and does not set any cookie',()=>{
    const res=response();beginOAuth({query:{origin:'https://attacker.example'}} as never,res);
    expect(res.status).toHaveBeenCalledWith(400);expect(res.cookie).not.toHaveBeenCalled();expect(res.redirect).not.toHaveBeenCalled();
  });
  it('shows a visible Georgian error when auth configuration is unavailable',()=>{
    vi.stubEnv('MANUS_PROJECT_ID','');const res=response();
    beginOAuth({query:{origin:'https://tiflisi-staff.vercel.app'}} as never,res);
    expect(res.status).toHaveBeenCalledWith(503);expect(res.send.mock.calls[0][0]).toContain('შესვლა დროებით მიუწვდომელია');expect(res.redirect).not.toHaveBeenCalled();
  });
});

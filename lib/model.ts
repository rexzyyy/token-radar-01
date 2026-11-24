export type SnapshotProtocol = { slug:string; name:string; category:string|null; chains:string[]; tvl_usd:number; change_7d:number|null; mcap_usd:number|null; listed_at:string|null; gecko_id:string|null; symbol:string|null };
export type Snapshot = { as_of:string; source:string; floor_usd:number; protocols:SnapshotProtocol[]; watchlist:string[] };
export type ModelConstants = { growth_floor:number; growth_cap:number; growth_weight:number; age_cap_days:number; maturity_floor:number; maturity_weight:number; chain_weight:number; chain_cap:number };
export type BoardRow = SnapshotProtocol & { rank:number; token_status:'pre-token'; age_days:number|null; implied_value_usd:number; model:{base_multiple:number;growth_pct:number;growth_multiplier:number;maturity_multiplier:number;age_days:number|null}; farm_steps:string[] };
export type RadarRow = { rank:number;slug:string;name:string;category:string|null;chains:string[];tvl_usd:number;change_7d:number|null;mcap_usd:number|null;listed_at:string|null;age_days:number|null;implied_value_usd:number;growth_multiplier:number;maturity_multiplier:number;farm_steps:string[] };
export type LiveRow = {slug:string;name:string;category:string|null;chains:string[];tvl_usd:number;mcap_usd:number;change_7d:number|null};
export type RadarData = {as_of:string;source:string;floor_usd:number;model:ModelConstants;model_version:string;watchlist_size:number;board_size:number;early_size:number;live_size:number;rows:RadarRow[];live:LiveRow[];fitted_multiples:{category:string;multiple:number;sample:number}[];global_multiple:number};
export const MODEL_VERSION='radar-2';
export const EARLY_ROWS=160;
export const LIVE_ROWS=24;
export const MODEL:ModelConstants={growth_floor:-60,growth_cap:120,growth_weight:.5,age_cap_days:1095,maturity_floor:.6,maturity_weight:.4,chain_weight:.03,chain_cap:4};
export function parseSnapshot(raw:string):Snapshot {
 const x=JSON.parse(raw);
 if(!x||!Array.isArray(x.protocols)||!Array.isArray(x.watchlist)) throw new Error('Invalid snapshot');
 return x as Snapshot;
}
export function isPreToken(p:SnapshotProtocol):boolean { return p.mcap_usd===null&&p.gecko_id===null&&p.symbol===null; }
export function isRankable(p:SnapshotProtocol):boolean { return isPreToken(p)&&p.category!=='CEX'&&!/(?:\s(?:v?\d+(?:\.\d+)?|v\d+))$/i.test(p.name); }
export function ageDays(p:SnapshotProtocol,asOf:string):number|null {
 if(!p.listed_at)return null;
 const n=Math.floor((Date.parse(asOf+'T00:00:00Z')-Date.parse(p.listed_at+'T00:00:00Z'))/86400000);
 return Math.max(0,n);
}
function median(a:number[]):number { a.sort((x,y)=>x-y); const m=a.length>>1; return a.length%2?a[m]:(a[m-1]+a[m])/2; }
function calibration(s:Snapshot) {
 const all=s.protocols.filter(p=>p.mcap_usd!==null&&p.tvl_usd>0).map(p=>p.mcap_usd!/p.tvl_usd);
 const global=Math.min(2,Math.max(.05,median([...all])));
 const cats=new Map<string,number[]>();
 for(const p of s.protocols) if(p.mcap_usd!==null&&p.tvl_usd>0){const c=p.category??'Uncategorized';cats.set(c,[...(cats.get(c)??[]),p.mcap_usd/p.tvl_usd]);}
 const multiples=[...cats].map(([category,v])=>({category,multiple:Math.min(2,Math.max(.05,v.length>=5?median([...v]):global)),sample:v.length})).sort((a,b)=>a.category.localeCompare(b.category));
 return {global,multiples,byCategory:new Map(multiples.map(x=>[x.category,x.multiple]))};
}
function baseFor(p:SnapshotProtocol,c:ReturnType<typeof calibration>):number{return c.byCategory.get(p.category??'Uncategorized')??c.global;}
export function impliedValue(p:SnapshotProtocol,s:Snapshot,base=baseFor(p,calibration(s))):number {
 const age=ageDays(p,s.as_of), growth=1+Math.max(MODEL.growth_floor,Math.min(MODEL.growth_cap,p.change_7d??0))/100*MODEL.growth_weight;
 const maturity=MODEL.maturity_floor+Math.min(age??365,MODEL.age_cap_days)/MODEL.age_cap_days*MODEL.maturity_weight;
 const breadth=1+MODEL.chain_weight*Math.min(Math.max(0,p.chains.length-1),MODEL.chain_cap);
 return Math.max(1,Math.round(p.tvl_usd*base*growth*maturity*breadth));
}
export function farmSteps(p:SnapshotProtocol,age:number|null):string[] {
 const cash=p.tvl_usd>=5e9?250:p.tvl_usd>=1e9?150:p.tvl_usd>=1e8?100:50, days=age!==null&&age<180?60:age!==null&&age<365?45:30, chain=p.chains[0]??'the listed chain';
 const c=(n:number)=>'$'+n+' USDC';
 let action='Make a USDC deposit';
 const cat=(p.category??'').toLowerCase();
 if(/lend|borrow/.test(cat))action='Supply USDC to the lending market';
 else if(/dex|exchange/.test(cat))action='Add a balanced USDC pair to the DEX pool';
 else if(/bridge/.test(cat))action='Bridge a small USDC amount to the destination chain';
 else if(/staking/.test(cat))action='Stake the supported asset';
 else if(/perp/.test(cat))action='Post USDC as perps margin';
 else if(/prediction/.test(cat))action='Take a small position in an active market';
 else if(/vault/.test(cat))action='Deposit USDC into a vault';
 else if(/stable/.test(cat))action='Mint the supported stable asset';
 else if(/rwa/.test(cat))action='Complete an eligible RWA mint';
 else if(/insurance/.test(cat))action='Quote and buy a small cover position';
 return [
  `Create a fresh wallet for ${p.name} on ${chain}; keep its recovery phrase offline. Cost: 0 USD plus network gas. Time: 10 minutes.`,
  `${action} on ${chain} with ${c(cash)} and confirm the transaction in your wallet. Cost: ${c(cash)} plus gas. Time: 20 minutes.`,
  `Repeat one useful ${p.category??'protocol'} action each week, varying the amount slightly while keeping receipts. Cost: ${c(Math.max(10,Math.round(cash/5)))} weekly plus gas. Time: 15 minutes weekly.`,
  `Keep the position active for ${days} days and check it weekly for safety or withdrawal conditions. Cost: capital remains exposed; gas for checks. Time: ${days} days.`,
  `Claim rewards only through a link published by ${p.name} itself; verify the domain before signing. Cost: gas only if a claim exists. Time: 10 minutes when available.`,
  `Maintain a farm log with dates, chain, transaction IDs, amounts and fees for every ${p.name} interaction. Cost: 0 USD. Time: 5 minutes weekly.`
 ];
}
export function stepText(step:string):string{return step;}
export function radarRow(r:BoardRow):RadarRow{return {rank:r.rank,slug:r.slug,name:r.name,category:r.category,chains:r.chains,tvl_usd:r.tvl_usd,change_7d:r.change_7d,mcap_usd:r.mcap_usd,listed_at:r.listed_at,age_days:r.age_days,implied_value_usd:r.implied_value_usd,growth_multiplier:r.model.growth_multiplier,maturity_multiplier:r.model.maturity_multiplier,farm_steps:r.farm_steps};}
export function liveRows(s:Snapshot):LiveRow[]{return s.protocols.filter(p=>!isPreToken(p)&&p.category!=='CEX'&&p.mcap_usd!==null).sort((a,b)=>b.mcap_usd!-a.mcap_usd!||a.slug.localeCompare(b.slug)).slice(0,LIVE_ROWS).map(p=>({slug:p.slug,name:p.name,category:p.category,chains:p.chains,tvl_usd:p.tvl_usd,mcap_usd:p.mcap_usd!,change_7d:p.change_7d}));}
export function buildRadar(s:Snapshot):{rows:BoardRow[];radar:RadarData} {
 const c=calibration(s), watch=new Set(s.watchlist), ranked=s.protocols.filter(isRankable), earlyPool=s.protocols.filter(p=>isRankable(p)&&p.tvl_usd<s.floor_usd);
 const selected=new Map<string,SnapshotProtocol>();
 for(const p of ranked.filter(p=>watch.has(p.slug)))selected.set(p.slug,p);
 for(const p of earlyPool.filter(p=>!watch.has(p.slug)).sort((a,b)=>b.tvl_usd-a.tvl_usd||a.slug.localeCompare(b.slug)).slice(0,EARLY_ROWS))selected.set(p.slug,p);
 const rows=[...selected.values()].map(p=>{const age=ageDays(p,s.as_of), growth=1+Math.max(-60,Math.min(120,p.change_7d??0))/100*.5, maturity=.6+Math.min(age??365,1095)/1095*.4;
 return {...p,rank:0,token_status:'pre-token' as const,age_days:age,implied_value_usd:impliedValue(p,s,baseFor(p,c)),model:{base_multiple:baseFor(p,c),growth_pct:p.change_7d??0,growth_multiplier:growth,maturity_multiplier:maturity,age_days:age},farm_steps:farmSteps(p,age)};}).sort((a,b)=>b.implied_value_usd-a.implied_value_usd||a.slug.localeCompare(b.slug)).map((r,i)=>({...r,rank:i+1}));
 const radar:RadarData={as_of:s.as_of,source:s.source,floor_usd:s.floor_usd,model:MODEL,model_version:MODEL_VERSION,watchlist_size:s.watchlist.length,board_size:rows.length,early_size:rows.length-s.watchlist.length,live_size:Math.min(LIVE_ROWS,liveRows(s).length),rows:rows.map(radarRow),live:liveRows(s),fitted_multiples:c.multiples,global_multiple:c.global};
 return {rows,radar};
}
export function boardIssue(rows:BoardRow[],watchlist:string[]):string|null {
 const have=new Set(rows.map(r=>r.slug)), missing=watchlist.filter(x=>!have.has(x));
 if(missing.length)return 'Missing watchlist slugs: '+missing.join(', ');
 if(rows.some((r,i)=>r.rank!==i+1))return 'Ranks must be consecutive from 1';
 if(rows.some((r,i)=>i>0&&rows[i-1].implied_value_usd<r.implied_value_usd))return 'Rows are not sorted by implied value';
 if(rows.length>1&&new Set(rows.map(r=>r.implied_value_usd)).size===1)return 'All implied values are identical';
 for(const r of rows){if(!Number.isSafeInteger(r.implied_value_usd)||r.implied_value_usd<1)return 'Invalid implied value for '+r.slug;if(r.farm_steps.length<3||r.farm_steps.length>12||r.farm_steps.some(x=>x.trim().length<20||x.trim().length>600))return 'Invalid farm steps for '+r.slug;}
 return null;
}
export function dataScript(radar:RadarData):string{return 'window.RADAR='+JSON.stringify(radar)+';\n';}

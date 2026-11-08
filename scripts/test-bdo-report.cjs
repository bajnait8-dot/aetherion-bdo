const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(file, mocks = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const js = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020}}).outputText;
  const exports = {};
  new Function('exports','require','Buffer',js)(exports, id => {
    if (id in mocks) return mocks[id];
    throw new Error(`Unexpected dependency: ${id}`);
  }, Buffer);
  return exports;
}
const decoder = load('src/lib/bdo-report-decoder.ts');
const {decodeReport,REPORT_VERSION,reportMergePlan,ReportConflict} = decoder;
function frame(names=['Üçok']) {
  const b=Buffer.alloc(32+333*names.length);b.writeUInt16LE(b.length);b.set([0,0x50,0x1a],2);b.writeUInt32LE(names.length,24);
  names.forEach((name,i)=>{
    const pos=33+333*i;b.write(name,pos,62,'utf16le');b[pos+76]=28;b[pos+77]=2;
    for(const [off,n] of [[80,17],[112,2],[128,3],[136,4],[224,42464],[232,362354],[264,2],[312,488],[320,2404]])b.writeBigUInt64LE(BigInt(n),pos+off);
  });return b;
}
const report=decodeReport(frame().toString('base64'),REPORT_VERSION);
assert.equal(report.rows[0].familyName,'Üçok');assert.equal(report.rows[0].stats.kills,9);assert.equal(report.rows[0].stats.survivalSeconds,2404);
assert.equal(Buffer.from(report.rows[0].rawRecordBase64,'base64').length,333);assert.equal(Object.keys(report.rows[0].counters).length,31);
assert.throws(()=>decodeReport(frame().subarray(0,-1).toString('base64'),REPORT_VERSION));
assert.throws(()=>decodeReport(frame(['Foo','foo']).toString('base64'),REPORT_VERSION));
assert.throws(()=>decodeReport(frame().toString('base64'),'unknown'));
const overflow=frame();overflow.writeBigUInt64LE(9007199254740992n,33+224);assert.throws(()=>decodeReport(overflow.toString('base64'),REPORT_VERSION));
// 8 Kasım 2026 yamasının rapor biçimi (v3, opcode 0x1553). Aşağıdaki
// çerçeve o savaşın gerçek kaydından kesildi: 35 baytlık başlık + Xiuu
// satırı; uzunluk ve satır sayısı tek satıra göre düzeltildi. Sayılar
// oyunun sonuç ekranıyla ve kill-feed'le çapraz doğrulandı: savaşın
// tamamında 30 satır, 156 kill, 552 ölüm, her satırda ölü + yaşam = 2206.
const V3_GERCEK =
  '6a010053159c5fc16ff28623005705f42835010000020000000b000101000000000b00013900892e0000000000000000' +
  '005800690075007500000000000000000000000000000000000000000000000000000000000000000000000000000000' +
  '000000000000000000000000000000000a17000000000000000000000000000000000000000000000000000000000000' +
  '00000000000000000000000000000000000400000000000000050000000000000000000000000000000b000000000000' +
  '000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
  '00000000000000000000000000000000002dfb08000000000085eb0900000000003c000000000000001bd90500000000' +
  '0004ba010000000000030000000000000079be2700000000000000000000000000000000000000000000000000000000' +
  '0000000000000000003e02000000000000600600000000000002';
{
  const f = Buffer.from(V3_GERCEK, 'hex');
  assert.equal(f.length, 362);
  const r = decodeReport(f.toString('base64'), decoder.REPORT_VERSION_V3);
  assert.equal(r.version, decoder.REPORT_VERSION_V3);
  assert.equal(r.rows.length, 1);
  const x = r.rows[0];
  assert.equal(x.familyName, 'Xiuu');
  assert.equal(x.classKey, 10);                       // Corsair
  assert.equal(x.specKey, 0, 'v3 spec taşımıyor, uydurulmamalı');
  assert.equal(x.stats.kills, 9);
  assert.equal(x.stats.deaths, 23);
  assert.equal(x.stats.damageDealt, 588589);
  assert.equal(x.stats.deathSeconds + x.stats.survivalSeconds, 2206);
  assert.equal(Buffer.from(x.rawRecordBase64, 'base64').length, 327);
  assert.equal(Object.keys(x.counters).length, 31);
  assert.equal(Buffer.from(r.headerBase64, 'base64').length, 35);
  // Biçimler birbirine karışmamalı
  assert.throws(() => decodeReport(f.toString('base64'), REPORT_VERSION));
  assert.throws(() => decodeReport(frame().toString('base64'), decoder.REPORT_VERSION_V3));
  // Satır sayısı uzunlukla tutmuyorsa reddedilmeli
  const bozuk = Buffer.from(f);
  bozuk.writeUInt32LE(2, 28);
  assert.throws(() => decodeReport(bozuk.toString('base64'), decoder.REPORT_VERSION_V3));
  assert.ok(decoder.REPORT_VERSIONS.includes(decoder.REPORT_VERSION_V3));
}

const actor={id:1,guildId:1,isAdmin:false,isGuildAdmin:true};
const incoming=decodeReport(frame(['NewAlly']).toString('base64'),REPORT_VERSION).rows;
const existing=[{id:1,inGameName:'OurPlayer',reportGuildId:1,userId:10}];
assert.equal(reportMergePlan(incoming,existing,[],{guildId:2,isAdmin:false})[0].previous,undefined);
assert.equal(existing.length,1);assert.equal(existing[0].inGameName,'OurPlayer');
assert.throws(()=>reportMergePlan(incoming,[{id:2,inGameName:'NewAlly',reportGuildId:1,userId:null}],[],{guildId:2,isAdmin:false}),ReportConflict);
assert.throws(()=>reportMergePlan(incoming,[],[{id:11,familyName:'NewAlly',guildId:1}],{guildId:2,isAdmin:false}),ReportConflict);

// Exercise actual importer with a transactional in-memory DB double. This
// checks idempotent snapshots, partner preservation and rollback, not Postgres.
let stored=[];let writes=0;
const prisma={
  guild:{findUnique:async()=>({isPrimary:false})},
  war:{findFirst:async()=>({id:77}),findMany:async()=>[]},
  $transaction:async fn=>{
    const working=structuredClone(stored);
    const result=await fn({
      $queryRaw:async()=>[{id:77}],
      user:{findMany:async()=>[]},
      warPerformance:{
        findMany:async()=>working,
        create:async({data})=>{writes++;working.push({id:working.length+1,userId:null,...data});},
        update:async({where,data})=>{writes++;Object.assign(working.find(r=>r.id===where.id),data);},
      },
    });stored=working;return result;
  },
};
const importer=load('src/lib/bdo-report-import.ts',{'@/lib/prisma':{prisma},'@/lib/classes':{BDO_CLASSES:[{classType:28,id:'buyucu'}]},'./bdo-report-decoder':decoder});
async function run(){
  if(process.env.BDO_REPORT_FIXTURE){
    const pcap=fs.readFileSync(process.env.BDO_REPORT_FIXTURE),streams=new Map();let pos=24,actual=null;
    assert.equal(pcap.readUInt32LE(20),0,'local sample is DLT_NULL');
    while(pos+16<=pcap.length){
      const length=pcap.readUInt32LE(pos+8);pos+=16;if(pos+length>pcap.length)break;
      const ip=pcap.subarray(pos+4,pos+length);pos+=length;if(ip.length<20||ip[9]!==6)continue;
      const tcp=ip.subarray((ip[0]&15)*4),data=tcp.subarray((tcp[12]>>4)*4);
      if(!data.length)continue;
      const key=tcp.readUInt16BE(0)+':'+tcp.readUInt16BE(2),seq=tcp.readUInt32BE(4);
      const chunks=streams.get(key)||new Map();streams.set(key,chunks);
      if(!chunks.has(seq)||chunks.get(seq).length<data.length)chunks.set(seq,data);
    }
    for(const chunks of streams.values()){
      const pieces=[];let end;
      for(const [seq,data] of Array.from(chunks.entries()).sort((a,b)=>a[0]-b[0])){
        if(end!==undefined&&seq>end){pieces.push(Buffer.alloc(seq-end));}
        pieces.push(data.subarray(Math.max(0,(end??seq)-seq)));end=Math.max(end??0,seq+data.length);
      }
      const stream=Buffer.concat(pieces);
      for(let i=0;i+32<stream.length;i++){
        if(stream[i+2]!==0||stream.readUInt16LE(i+3)!==0x1a50)continue;
        const len=stream.readUInt16LE(i);if(i+len>stream.length)continue;
        try{actual=decodeReport(stream.subarray(i,i+len).toString('base64'),REPORT_VERSION);}catch{}
        if(actual)break;
      }
      if(actual)break;
    }
    assert.ok(actual);assert.equal(actual.rows.length,29);
    const expected={ESMERBOMBA:[1,17,42464,2404],Genzo:[12,16,374156,2495],ATM4CA:[2,18,116109,2336],Hinaru:[4,14,130585,2442],RAJ0N:[4,31,337847,2040]};
    for(const [name,values] of Object.entries(expected)){
      const r=actual.rows.find(r=>r.familyName===name).stats;
      assert.deepEqual([r.kills,r.deaths,r.damageDealt,r.survivalSeconds],values);
    }
    console.log('PASS: actual local capture decoded as 29 complete rows; screenshot values matched');
  }
  assert.equal(await importer.canImportReports({...actor,isGuildAdmin:false}),false);
  assert.equal(await importer.canImportReports({...actor,guildId:null}),false);
  assert.deepEqual(await importer.reportWarScope(actor),{isAllyWar:true});
  await importer.importReport(77,report,actor);
  await importer.importReport(77,report,actor);
  assert.equal(stored.length,1);assert.equal(stored[0].kills,9);assert.equal(stored[0].class,'buyucu');
  await importer.importReport(77,decodeReport(frame(['NewAlly']).toString('base64'),REPORT_VERSION),{...actor,id:2,guildId:2});
  assert.equal(stored.length,2);assert.equal(stored[0].kills,9);
  const before=structuredClone(stored),beforeWrites=writes;
  await assert.rejects(()=>importer.importReport(77,decodeReport(frame(['Other','Üçok']).toString('base64'),REPORT_VERSION),{...actor,guildId:2}),ReportConflict);
  assert.deepEqual(stored,before);assert.equal(writes,beforeWrites);

  // Route auth and malformed/oversized requests must not reach any writes.
  let routeActor={...actor,isGuildAdmin:false};
  const gate={withApp:async(req,fn)=>routeActor?fn(routeActor):new Response('',{status:401}),APP_HEADERS:{},appError:(error,status)=>Response.json({error},{status})};
  const routes=load('src/app/api/app/wars/[id]/report-capture/route.ts',{'next/server':{NextResponse:Response},'@/lib/app-gate':gate,'@/lib/prisma':{prisma},'@/lib/bdo-report-decoder':decoder,'@/lib/bdo-report-import':importer});
  const request=(body)=>new Request('http://local/api/app/wars/77/report-capture',{method:'POST',body:JSON.stringify(body)});
  assert.equal((await routes.POST(request({}),{params:{id:'77'}})).status,403);
  routeActor=null;assert.equal((await routes.POST(request({}),{params:{id:'77'}})).status,401);
  routeActor=actor;
  assert.equal((await routes.POST(request({}),{params:{id:'77'}})).status,400);
  assert.equal((await routes.POST(request({x:'a'.repeat(100001)}),{params:{id:'77'}})).status,413);
  assert.equal((await routes.POST(request({frameBase64:frame().toString('base64'),parserVersion:REPORT_VERSION}),{params:{id:'77'}})).status,200);
  prisma.war.findFirst=async()=>null;
  assert.equal((await routes.POST(request({frameBase64:frame().toString('base64'),parserVersion:REPORT_VERSION}),{params:{id:'77'}})).status,404);
  console.log('PASS: decoder, Unicode, bounds, snapshots, ally preservation, conflicts/rollback, administrator and war permissions');
}
run().catch(e=>{console.error(e);process.exitCode=1;});

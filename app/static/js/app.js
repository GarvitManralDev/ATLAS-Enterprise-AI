// Simple single-workspace UI. No login, tokens, or user accounts.
// DOM nodes use textContent (never untrusted innerHTML).
const $=id=>document.getElementById(id);
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n};
const svg=path=>{const n=document.createElementNS('http://www.w3.org/2000/svg','svg');n.setAttribute('viewBox','0 0 24 24');n.setAttribute('fill','none');n.setAttribute('stroke','currentColor');n.setAttribute('stroke-width','1.8');n.setAttribute('stroke-linecap','round');n.setAttribute('stroke-linejoin','round');const p=document.createElementNS('http://www.w3.org/2000/svg','path');p.setAttribute('d',path);n.append(p);return n};
const ICON={
  thumb:'M7 10v11M15 5.9L14 10h5.6a2 2 0 0 1 2 2.3l-1.4 7A2 2 0 0 1 18.2 21H7V10l4-8a3 3 0 0 1 4 3.9z',
  copy:'M9 9h11v11H9zM5 15H4V4h11v1',
  file:'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5',
  arrow:'M5 12h14M13 6l6 6-6 6'
};

// Single-workspace conversation identifier, not an authentication token.
let conversationId=sessionStorage.getItem('atlas_conversation_id')||crypto.randomUUID();
sessionStorage.setItem('atlas_conversation_id',conversationId);

let toastTimer;
const toast=msg=>{const t=$('toast');t.textContent=msg;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),3500)};
const api=async(path,options={})=>{const res=await fetch(path,{...options,headers:{'Content-Type':'application/json',...(options.headers||{})}});const data=await res.json();if(!res.ok)throw Error(data.detail||'Request failed');return data};
const statusTone=s=>{s=String(s).trim().toLowerCase();if(['approved','indexed','ready','active','completed','processed'].includes(s))return 'ok';if(['pending','processing','uploaded','uploading'].includes(s))return 'warn';if(['rejected','failed','error','blocked'].includes(s))return 'bad';return ''};
const badge=s=>el('span','badge '+statusTone(s),s);
const empty=text=>el('div','empty',text);

// Navigation
const TITLES={chat:'Chat',docs:'Documents',approval:'Approvals',admin:'Metrics'};
function view(name){
  Object.keys(TITLES).forEach(x=>{$(x+'View').classList.toggle('hidden',x!==name);$(x+'Tab').classList.toggle('active',x===name)});
  $('heading').textContent=TITLES[name];
  $('newChat').classList.toggle('hidden',name!=='chat');
  if(name==='docs')loadDocs();if(name==='admin')loadMetrics();if(name==='approval')loadApprovals();
}
$('chatTab').onclick=()=>view('chat');$('docsTab').onclick=()=>view('docs');$('adminTab').onclick=()=>view('admin');$('approvalTab').onclick=()=>view('approval');$('refreshApprovals').onclick=loadApprovals;

// Chat
const hero=$('hero');
$('newChat').onclick=()=>{conversationId=crypto.randomUUID();sessionStorage.setItem('atlas_conversation_id',conversationId);$('messages').replaceChildren(hero);$('question').focus();toast('Started a new conversation')};

function scrollChat(){$('messages').scrollTo({top:$('messages').scrollHeight,behavior:'smooth'})}
function addMessage(content,kind,sources=[]){
  hero.remove();
  const msg=el('div','message '+kind);
  const bubble=el('div','bubble',content);msg.append(bubble);
  if(kind==='assistant'&&sources.length){
    const wrap=el('div','sources');
    sources.forEach(s=>{
      const d=el('details');const sum=el('summary');
      sum.append(el('span','cite',`[${s.index}]`),document.createTextNode(` ${s.title} · p. ${s.page}`));
      d.append(sum,el('p',null,s.excerpt));wrap.append(d);
    });
    bubble.append(wrap);
  }
  if(kind==='assistant'){
    const actions=el('div','msg-actions');
    const copy=el('button','icon-btn');copy.type='button';copy.append(svg(ICON.copy),document.createTextNode('Copy'));
    copy.onclick=async()=>{try{await navigator.clipboard.writeText(content);toast('Copied to clipboard')}catch{toast('Copy failed')}};
    actions.append(copy);
    if(sources.length){
      const fb=el('button','icon-btn');fb.type='button';fb.append(svg(ICON.thumb),document.createTextNode('Helpful'));
      fb.onclick=async()=>{try{await api('/api/feedback',{method:'POST',body:JSON.stringify({rating:1})});fb.classList.add('done');fb.disabled=true;toast('Thanks for the feedback')}catch(e){toast(e.message)}};
      actions.append(fb);
    }
    bubble.append(actions);
  }
  $('messages').append(msg);scrollChat();return msg;
}

const q=$('question');
const autosize=()=>{q.style.height='auto';q.style.height=Math.min(q.scrollHeight,200)+'px'};
q.addEventListener('input',autosize);
q.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();$('chatForm').requestSubmit()}});

$('chatForm').onsubmit=async e=>{
  e.preventDefault();const text=q.value.trim();if(!text)return;
  addMessage(text,'user');q.value='';autosize();
  const loading=addMessage('Searching approved documents','assistant loading');loading.querySelector('.msg-actions')?.remove();
  try{
    const r=await api('/api/chat',{method:'POST',body:JSON.stringify({question:text,conversation_id:conversationId})});
    loading.remove();const m=addMessage(r.answer,'assistant',r.sources||[]);
    if(r.status==='pending_approval'){
      const btn=el('button','btn ghost sm');btn.type='button';btn.append(document.createTextNode('Review approval request'),svg(ICON.arrow));
      btn.onclick=()=>view('approval');m.querySelector('.msg-actions').prepend(btn);
    }
  }catch(err){loading.className='message assistant error';loading.querySelector('.bubble').textContent=err.message}
};
document.querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>{q.value=b.dataset.q;autosize();q.focus()});

// Documents
async function loadDocs(){
  const root=$('docs');
  try{
    const r=await api('/api/documents');
    if(!r.documents.length){root.replaceWith(Object.assign(empty('No documents yet. Upload one above to get started.'),{id:'docs'}));return}
    const list=el('div','list');list.id='docs';
    r.documents.forEach(d=>{
      const row=el('div','list-row');
      const ico=el('div','file-ico');ico.append(svg(ICON.file));
      const info=el('div','grow');info.append(el('div','title',d.title));
      const sub=[`Version ${d.current_version}`];if(d.created_at)sub.push(new Date(d.created_at).toLocaleDateString());
      info.append(el('div','muted small',sub.join(' · ')));
      row.append(ico,info,badge(d.status));list.append(row);
    });
    root.replaceWith(list);
  }catch(e){root.replaceWith(Object.assign(empty(e.message),{id:'docs'}))}
}

const fileInput=$('file'),zone=$('uploadForm');
const showFile=()=>{const f=fileInput.files[0];const label=$('fileName');label.replaceChildren();if(f){label.append(el('strong',null,f.name),document.createTextNode(` · ${(f.size/1048576).toFixed(1)} MB`))}else{label.append(el('strong',null,'Choose a file'),document.createTextNode(' or drag it here'))}};
fileInput.onchange=showFile;
['dragenter','dragover'].forEach(ev=>zone.addEventListener(ev,e=>{e.preventDefault();zone.classList.add('drag')}));
['dragleave','drop'].forEach(ev=>zone.addEventListener(ev,e=>{e.preventDefault();zone.classList.remove('drag')}));
zone.addEventListener('drop',e=>{if(e.dataTransfer.files.length){fileInput.files=e.dataTransfer.files;showFile()}});

$('uploadForm').onsubmit=async e=>{
  e.preventDefault();const f=fileInput.files[0];if(!f)return;
  if(f.size>10485760){toast('Maximum file size is 10 MB');return}
  const btn=$('uploadBtn');btn.disabled=true;btn.textContent='Uploading…';
  try{
    const r=await api('/api/documents/uploads',{method:'POST',body:JSON.stringify({filename:f.name})});
    const up=await fetch(r.upload_url,{method:'PUT',headers:r.headers,body:f});if(!up.ok)throw Error('S3 upload failed');
    btn.textContent='Indexing…';toast('Uploaded to S3. Processing document…');
    await api('/api/documents/complete',{method:'POST',body:JSON.stringify({document_id:r.document_id})});
    toast('Document indexed');zone.reset();showFile();loadDocs();
  }catch(err){toast(err.message)}
  finally{btn.disabled=false;btn.textContent='Upload'}
};

// Metrics
const stat=(label,value)=>{const c=el('div','stat');c.append(el('div','label',label),el('div','value',String(value)));return c};
async function loadMetrics(){
  const m=$('metrics'),g=$('guardrailMetrics');
  try{
    const r=await api('/api/admin/metrics');
    const docs=r.documents||[],fb=r.feedback||[];
    const total=docs.reduce((n,d)=>n+Number(d.total),0);
    const cards=[stat('Total documents',total),...docs.map(d=>stat(d.status,d.total))];
    fb.forEach(f=>cards.push(stat(Number(f.rating)>0?'Helpful feedback':`Feedback (${f.rating})`,f.total)));
    m.replaceChildren(...cards);
  }catch(e){m.replaceChildren(empty(e.message))}
  try{
    const r=await api('/api/admin/guardrails');
    const labels={guardrail_input_blocked:'Inputs blocked',guardrail_output_blocked:'Outputs blocked'};
    const counts=Object.fromEntries((r.events||[]).map(x=>[x.action,x.total]));
    g.replaceChildren(...Object.entries(labels).map(([k,l])=>stat(l,counts[k]||0)),stat('Mode',String(r.mode||'—').replace(/_/g,' ')));
  }catch(e){g.replaceChildren(empty(e.message))}
}

// Admin approval workflow.
async function loadApprovals(){
  const root=$('approvalList');root.replaceChildren(el('div','muted','Loading approvals…'));
  try{
    const response=await api('/api/approvals');
    if(!Array.isArray(response.approvals)) throw Error('Unexpected API response: approvals list missing');
    const approvals=response.approvals;
    const pending=approvals.filter(a=>String(a.status).trim().toLowerCase()==='pending').length;
    $('approvalSummary').textContent=`${pending} pending · ${approvals.length} total (most recent 100)`;
    root.replaceChildren();
    if(!approvals.length){root.append(empty('No approval requests yet. Try asking the chatbot to delete a document.'));return}
    for(const a of approvals){
      const card=el('article','approval-card');
      const header=el('div','approval-header');
      header.append(el('strong',null,a.question),badge(a.status));card.append(header);
      card.append(el('p','meta',`Requested by ${a.requester} · ${new Date(a.created_at).toLocaleString()}`));
      if(String(a.status).trim().toLowerCase()==='pending'){
        const actions=el('div','approval-actions');
        for(const [label,approve] of [['Approve',true],['Reject',false]]){
          const button=el('button',approve?'btn ok sm':'btn danger sm',label);
          button.onclick=async()=>{
            const decision=approve?'approve':'reject';
            if(!confirm(`Are you sure you want to ${decision} this request? This records a decision only and does not execute the requested action.`))return;
            button.disabled=true;
            try{const r=await api(`/api/approvals/${encodeURIComponent(a.id)}/decision`,{method:'POST',body:JSON.stringify({approve})});toast(`Request ${r.status}. No action executed.`);await loadApprovals()}
            catch(e){toast(e.message);button.disabled=false}
          };
          actions.append(button);
        }
        card.append(actions);
      }else{
        card.append(el('p','meta',`Reviewed by ${a.reviewer||'unknown'}${a.reviewed_at?' · '+new Date(a.reviewed_at).toLocaleString():''} · No action executed`));
      }
      root.append(card);
    }
  }catch(e){root.replaceChildren(empty(`Unable to load approvals: ${e.message}`));console.error('Approvals loading failed:',e)}
}

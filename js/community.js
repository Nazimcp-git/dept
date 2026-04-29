// js/community.js — Community System with Auth Integration
// Theme Toggle
(function(){var r=document.documentElement,s=localStorage.getItem('theme')||'light';r.setAttribute('data-theme',s);var b=document.getElementById('theme-toggle');if(b){b.textContent=s==='dark'?'🌙':'☀️';b.addEventListener('click',function(){var n=r.getAttribute('data-theme')==='dark'?'light':'dark';r.setAttribute('data-theme',n);localStorage.setItem('theme',n);b.textContent=n==='dark'?'🌙':'☀️'});}})();
// Scroll Progress
(function(){var b=document.getElementById('progress-bar');if(b)window.addEventListener('scroll',function(){var h=document.documentElement.scrollHeight-window.innerHeight;b.style.width=h>0?(window.scrollY/h*100)+'%':'0%';});})();
// Toast
function showToast(m){var t=document.getElementById('toast');if(!t)return;t.textContent=m;t.classList.add('show');setTimeout(function(){t.classList.remove('show');},2800);}
// XSS
function escapeHTML(s){if(s==null)return'';return String(s).replace(/[&<>'"]/g,function(t){return({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[t]||t);});}

// Reflection prompts
const PROMPTS=[
  "What verse spoke to you today?",
  "How did you experience gratitude today?",
  "What act of kindness did you witness or perform?",
  "Which name of Allah resonated with you recently?",
  "What lesson from the Seerah applies to your life right now?",
  "How did you find patience in a difficulty today?",
  "What dua are you focusing on this week?",
  "Share a moment of peace you experienced today.",
  "What Qur'anic story inspires you most and why?",
  "How are you working on improving one habit this month?"
];
function getTodayPrompt(){var d=new Date();return PROMPTS[d.getDate()%PROMPTS.length];}

// Article cache for mentions
let articlesCache=[];
let articlesFetched=false;
async function fetchArticlesForMention(){
  if(articlesFetched)return articlesCache;
  try{const snap=await db.collection('articles').orderBy('createdAt','desc').limit(50).get();
  articlesCache=snap.docs.map(d=>({id:d.id,...d.data()}));articlesFetched=true;}catch(e){console.error(e);}
  return articlesCache;
}

// Parse article mentions in text
function parseArticleMentions(text){
  return escapeHTML(text).replace(/\[article:([^\]:]+):([^\]]+)\]/g,function(_,id,title){
    return'<a class="msg-article-link" href="article.html?id='+escapeHTML(id)+'" title="'+escapeHTML(title)+'">📖 '+escapeHTML(title)+'</a>';
  }).replace(/\n/g,'<br>');
}

// Main
document.addEventListener('DOMContentLoaded',()=>{
  const channelItems=document.querySelectorAll('.channel-item');
  const channelTitle=document.getElementById('current-channel-title');
  const channelDesc=document.getElementById('current-channel-desc');
  const chatMessages=document.getElementById('chat-messages');
  const chatInput=document.getElementById('chat-input');
  const btnSend=document.getElementById('btn-send-message');
  const authPrompt=document.getElementById('chat-auth-prompt');
  const chatInputArea=document.getElementById('chat-input-area');
  const sidebar=document.querySelector('.community-sidebar');
  const welcomeBanner=document.getElementById('welcome-banner');
  const welcomeClose=document.getElementById('welcome-banner-close');
  const reflectionPrompt=document.getElementById('reflection-prompt');
  const reflectionPromptText=document.getElementById('reflection-prompt-text');
  const qaContainer=document.getElementById('qa-container');
  const charCounter=document.getElementById('char-counter');
  const chattingAsBar=document.getElementById('chatting-as-bar');
  const chattingAsName=document.getElementById('chatting-as-name');
  const mentionDropdown=document.getElementById('mention-dropdown');
  const mentionList=document.getElementById('mention-dropdown-list');
  const btnAskQuestion=document.getElementById('btn-ask-question');
  const qaQuestionList=document.getElementById('qa-question-list');
  const qaThreadView=document.getElementById('qa-thread-view');
  const qaBackBtn=document.getElementById('qa-back-btn');
  const qaThreadTitle=document.getElementById('qa-thread-title');
  const qaThreadAuthor=document.getElementById('qa-thread-author');
  const qaThreadTime=document.getElementById('qa-thread-time');
  const qaThreadAnswerCount=document.getElementById('qa-thread-answer-count');
  const qaAnswersList=document.getElementById('qa-answers-list');
  const qaAnswerInput=document.getElementById('qa-answer-input');
  const btnSendAnswer=document.getElementById('btn-send-answer');
  const qaPendingNotice=document.getElementById('qa-pending-notice');

  let currentChannel='general';
  let currentUser=null;
  let unsubMessages=null;
  let unsubQuestions=null;
  let unsubAnswers=null;
  let currentThreadId=null;
  let mentionQuery='';
  let mentionActive=false;
  let selectedMentionIdx=-1;

  const channelInfo={
    'general':{title:'# General',desc:'Welcome to the community! Introduce yourself and chat with others.'},
    'articles':{title:'# Article Discussions',desc:'Discuss your favorite articles. Type / to mention an article.'},
    'qa':{title:'# Q & A',desc:"Ask questions and get answers. Questions require admin approval."},
    'reflections':{title:'# Reflections',desc:'Share your personal spiritual reflections. Max 500 characters.'}
  };

  // Mobile sidebar
  const mobileSidebarBtn=document.getElementById('btn-toggle-sidebar');
  if(mobileSidebarBtn&&sidebar){mobileSidebarBtn.addEventListener('click',()=>{sidebar.classList.toggle('sidebar-open');mobileSidebarBtn.textContent=sidebar.classList.contains('sidebar-open')?'?':'? Channels';});}

  // Welcome banner
  if(welcomeClose){welcomeClose.addEventListener('click',()=>{welcomeBanner.style.display='none';localStorage.setItem('community_welcomed','1');});}

  // Channel switch
  function switchChannel(ch){
    currentChannel=ch;
    channelTitle.textContent=channelInfo[ch].title;
    channelDesc.textContent=channelInfo[ch].desc;
    channelItems.forEach(i=>i.classList.toggle('active',i.dataset.channel===ch));
    if(sidebar)sidebar.classList.remove('sidebar-open');
    if(mobileSidebarBtn)mobileSidebarBtn.textContent='? Channels';
    // Toggle views
    const isQA=ch==='qa';
    qaContainer.style.display=isQA?'flex':'none';
    chatMessages.style.display=isQA?'none':'flex';
    chatInputArea.style.display=isQA?'none':'flex';
    // Welcome banner
    welcomeBanner.style.display=(ch==='general'&&!localStorage.getItem('community_welcomed'))?'flex':'none';
    // Reflection prompt
    if(ch==='reflections'){reflectionPrompt.style.display='flex';reflectionPromptText.textContent=getTodayPrompt();charCounter.style.display='block';chatInput.placeholder='Share your reflection (max 500 chars)...';}
    else{reflectionPrompt.style.display='none';charCounter.style.display='none';chatInput.placeholder=ch==='articles'?'Type / to mention an article...':'Type your message...';}
    // Close mention dropdown
    closeMentionDropdown();
    // Load data
    if(isQA){showQuestionList();loadQuestions();}
    else{loadMessages(ch);}
  }
  channelItems.forEach(item=>{item.addEventListener('click',()=>switchChannel(item.dataset.channel));});

  // Auth observer
  auth.onAuthStateChanged(user=>{
    currentUser=user;
    if(authPrompt){
      if(user){
        authPrompt.style.display='none';chatInput.disabled=false;btnSend.disabled=false;
        chattingAsBar.style.display='flex';chattingAsName.textContent=user.displayName||user.email||'User';
        btnAskQuestion.disabled=false;qaAnswerInput.disabled=false;btnSendAnswer.disabled=false;
      }else{
        authPrompt.style.display='flex';chatInput.disabled=true;btnSend.disabled=true;
        chattingAsBar.style.display='none';
        btnAskQuestion.disabled=true;qaAnswerInput.disabled=true;btnSendAnswer.disabled=true;
      }
    }
    if(currentChannel==='qa')loadQuestions();
    else loadMessages(currentChannel);
  });

  // Input auto-resize + char counter
  chatInput.addEventListener('input',function(){
    this.style.height='52px';this.style.height=Math.min(this.scrollHeight,120)+'px';
    btnSend.style.opacity=(this.value.trim().length>0&&currentUser)?'1':'0.7';
    if(currentChannel==='reflections'){
      const len=this.value.length;charCounter.textContent=len+' / 500';
      charCounter.className='char-counter'+(len>=450?' near-limit':'')+(len>=500?' at-limit':'');
      if(len>500)this.value=this.value.substring(0,500);
    }
    // Article mention
    if(currentChannel==='articles')handleMentionInput(this.value);
  });

  // Send message
  btnSend.addEventListener('click',sendMessage);
  chatInput.addEventListener('keydown',(e)=>{
    if(mentionActive){
      if(e.key==='ArrowDown'){e.preventDefault();navigateMention(1);return;}
      if(e.key==='ArrowUp'){e.preventDefault();navigateMention(-1);return;}
      if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();selectMention();return;}
      if(e.key==='Escape'){closeMentionDropdown();return;}
    }
    if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage();}
  });

  async function sendMessage(){
    let text=chatInput.value.trim();
    if(!text||!currentUser)return;
    if(currentChannel==='reflections'&&text.length>500)text=text.substring(0,500);
    const name=currentUser.displayName||currentUser.email||'Anonymous Explorer';
    chatInput.value='';chatInput.style.height='52px';btnSend.style.opacity='0.7';
    if(currentChannel==='reflections')charCounter.textContent='0 / 500';
    closeMentionDropdown();
    try{
      await db.collection('community_messages').add({
        channel:currentChannel,text,userId:currentUser.uid,userName:name,
        userInitial:name.charAt(0).toUpperCase(),userPhoto:currentUser.photoURL||null,
        createdAt:firebase.firestore.FieldValue.serverTimestamp(),likes:[]
      });
    }catch(e){console.error(e);showToast('Error sending message.');}
  }

  // Load messages
  function loadMessages(channel){
    if(unsubMessages)unsubMessages();
    chatMessages.innerHTML='<div class="empty-state" style="padding:2rem;text-align:center;color:var(--text-muted);width:100%;"><div class="spinner" style="margin:0 auto 1rem;"></div><p>Loading messages...</p></div>';
    unsubMessages=db.collection('community_messages').where('channel','==',channel).orderBy('createdAt','asc').limit(100)
    .onSnapshot(snap=>{
      if(snap.empty){chatMessages.innerHTML='<div class="empty-state" style="padding:3rem 1rem;text-align:center;color:var(--text-muted);width:100%;"><div style="font-size:2.5rem;margin-bottom:1rem;">💬</div><p>No messages yet. Be the first!</p></div>';return;}
      chatMessages.innerHTML='';
      snap.forEach(doc=>{
        const msg=doc.data(),msgId=doc.id;
        const isOwn=currentUser&&msg.userId===currentUser.uid;
        const hasLiked=currentUser&&Array.isArray(msg.likes)&&msg.likes.includes(currentUser.uid);
        const likeCount=Array.isArray(msg.likes)?msg.likes.length:0;
        let timeStr='Just now';if(msg.createdAt)timeStr=msg.createdAt.toDate().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
        const avatarHTML=msg.userPhoto?'<img src="'+escapeHTML(msg.userPhoto)+'" class="message-avatar message-avatar-img" alt="'+escapeHTML(msg.userInitial)+'" referrerpolicy="no-referrer">':'<div class="message-avatar">'+escapeHTML(msg.userInitial||'U')+'</div>';
        const deleteBtn=isOwn?'<button class="btn-message-delete" onclick="deleteMessage(\''+msgId+'\')" title="Delete"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg></button>':'';
        const isReflection=channel==='reflections';
        const parsedText=(channel==='articles')?parseArticleMentions(msg.text):escapeHTML(msg.text).replace(/\n/g,'<br>');
        const w=document.createElement('div');
        if(isReflection){
          w.className='reflection-card';
          w.innerHTML=avatarHTML.replace('message-avatar"','message-avatar" style="width:32px;height:32px;font-size:0.8rem"')+'<div class="reflection-card-header">'+avatarHTML+'<span class="reflection-card-author">'+escapeHTML(msg.userName)+'</span><span class="reflection-card-time">'+escapeHTML(timeStr)+'</span></div><div class="reflection-card-body">'+parsedText+'</div><div class="reflection-card-actions"><button class="btn-message-like '+(hasLiked?'liked':'')+'" onclick="toggleLike(\''+msgId+'\','+hasLiked+')"><svg viewBox="0 0 24 24" width="14" height="14" fill="'+(hasLiked?'currentColor':'none')+'" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> '+(likeCount>0?likeCount:'Like')+'</button>'+deleteBtn+'</div>';
        }else{
          w.className='message-wrapper '+(isOwn?'own-message':'');w.dataset.msgId=msgId;
          w.innerHTML=avatarHTML+'<div class="message-content"><div class="message-header"><span class="message-author">'+escapeHTML(msg.userName)+'</span><span class="message-time">'+escapeHTML(timeStr)+'</span></div><div class="message-bubble">'+parsedText+'</div><div class="message-actions"><button class="btn-message-like '+(hasLiked?'liked':'')+'" onclick="toggleLike(\''+msgId+'\','+hasLiked+')"><svg viewBox="0 0 24 24" width="14" height="14" fill="'+(hasLiked?'currentColor':'none')+'" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> '+(likeCount>0?likeCount:'Like')+'</button>'+deleteBtn+'</div></div>';
        }
        chatMessages.appendChild(w);
      });
      setTimeout(()=>{chatMessages.scrollTop=chatMessages.scrollHeight;},100);
    },err=>{
      console.error(err);
      const m=err.message?err.message.match(/https:\/\/console\.firebase\.google\.com[^\s]+/):null;
      chatMessages.innerHTML=m?'<div class="empty-state" style="padding:2rem;text-align:center;color:#DC2626;width:100%;"><p>⚠️ Firestore Index Required.</p><a href="'+m[0]+'" target="_blank" rel="noopener" style="color:var(--green);text-decoration:underline;">Create Index Here 🔗</a></div>':'<div class="empty-state" style="padding:2rem;text-align:center;color:var(--text-muted);width:100%;"><p>Could not load messages. Please refresh.</p></div>';
    });
  }

  // -- Article Mention System --------------------------
  function handleMentionInput(val){
    const lastSlash=val.lastIndexOf('/');
    if(lastSlash===-1||lastSlash<val.lastIndexOf(' ',lastSlash)){closeMentionDropdown();return;}
    mentionQuery=val.substring(lastSlash+1).toLowerCase();
    mentionActive=true;selectedMentionIdx=-1;
    showMentionDropdown();
  }
  async function showMentionDropdown(){
    const arts=await fetchArticlesForMention();
    const filtered=mentionQuery?arts.filter(a=>(a.title||'').toLowerCase().includes(mentionQuery)):arts.slice(0,8);
    if(!filtered.length){mentionList.innerHTML='<div class="mention-no-results">No articles found</div>';mentionDropdown.classList.add('active');return;}
    mentionList.innerHTML=filtered.slice(0,8).map((a,i)=>'<div class="mention-item'+(i===selectedMentionIdx?' selected':'')+'" data-id="'+a.id+'" data-title="'+escapeHTML(a.title)+'"><div class="mention-item-icon">📖</div><div class="mention-item-info"><div class="mention-item-title">'+escapeHTML(a.title)+'</div><div class="mention-item-category">'+(a.category||'General')+'</div></div></div>').join('');
    mentionDropdown.classList.add('active');
    mentionList.querySelectorAll('.mention-item').forEach(el=>{el.addEventListener('click',()=>{insertMention(el.dataset.id,el.dataset.title);});});
  }
  function navigateMention(dir){
    const items=mentionList.querySelectorAll('.mention-item');if(!items.length)return;
    selectedMentionIdx=Math.max(0,Math.min(items.length-1,selectedMentionIdx+dir));
    items.forEach((el,i)=>el.classList.toggle('selected',i===selectedMentionIdx));
    items[selectedMentionIdx].scrollIntoView({block:'nearest'});
  }
  function selectMention(){
    const items=mentionList.querySelectorAll('.mention-item');
    if(selectedMentionIdx>=0&&items[selectedMentionIdx]){const el=items[selectedMentionIdx];insertMention(el.dataset.id,el.dataset.title);}
  }
  function insertMention(id,title){
    const val=chatInput.value;const lastSlash=val.lastIndexOf('/');
    chatInput.value=val.substring(0,lastSlash)+'[article:'+id+':'+title+'] ';
    closeMentionDropdown();chatInput.focus();
  }
  function closeMentionDropdown(){mentionDropdown.classList.remove('active');mentionActive=false;selectedMentionIdx=-1;}

  // -- Q&A System --------------------------------------
  function showQuestionList(){qaThreadView.style.display='none';qaQuestionList.style.display='flex';if(unsubAnswers){unsubAnswers();unsubAnswers=null;}currentThreadId=null;}
  function showThreadView(){qaQuestionList.style.display='none';qaThreadView.style.display='flex';}
  qaBackBtn.addEventListener('click',()=>{showQuestionList();loadQuestions();});

  // Ask question
  btnAskQuestion.addEventListener('click',()=>{
    if(!currentUser){showAuthModal('login');return;}
    const text=prompt('Enter your question:');
    if(!text||!text.trim())return;
    const name=currentUser.displayName||currentUser.email||'Anonymous';
    db.collection('community_questions').add({
      text:text.trim(),userId:currentUser.uid,userName:name,
      status:'pending',answerCount:0,
      createdAt:firebase.firestore.FieldValue.serverTimestamp()
    }).then(()=>showToast('Question submitted! Awaiting admin approval.')).catch(e=>{console.error(e);showToast('Error submitting question.');});
  });

  // Load questions
  function loadQuestions(){
    if(unsubQuestions)unsubQuestions();
    const filterPills=document.querySelectorAll('.qa-filter-pill');
    let activeFilter='approved';
    filterPills.forEach(p=>{if(p.classList.contains('active'))activeFilter=p.dataset.qaFilter;});
    let query;
    if(activeFilter==='my'&&currentUser){
      query=db.collection('community_questions').where('userId','==',currentUser.uid).orderBy('createdAt','desc');
    }else{
      query=db.collection('community_questions').where('status','==','approved').orderBy('createdAt','desc');
    }
    qaQuestionList.innerHTML='<div class="qa-empty-state"><div class="icon">?</div><p>Loading questions...</p></div>';
    unsubQuestions=query.limit(50).onSnapshot(snap=>{
      // Check pending
      if(currentUser){
        db.collection('community_questions').where('userId','==',currentUser.uid).where('status','==','pending').get()
        .then(ps=>{qaPendingNotice.style.display=ps.empty?'none':'flex';qaPendingNotice.querySelector('span').textContent='You have '+ps.size+' question(s) awaiting admin approval.';});
      }
      if(snap.empty){qaQuestionList.innerHTML='<div class="qa-empty-state"><div class="icon">?</div><p>'+(activeFilter==='my'?"You haven't asked any questions yet.":"No approved questions yet. Be the first to ask!")+'</p></div>';return;}
      qaQuestionList.innerHTML='';
      snap.forEach(doc=>{
        const q=doc.data(),qid=doc.id;
        let timeStr='Just now';if(q.createdAt)timeStr=q.createdAt.toDate().toLocaleDateString([],{month:'short',day:'numeric'});
        const statusBadge=activeFilter==='my'?'<span class="qa-status-badge '+q.status+'">'+q.status+'</span>':'';
        const card=document.createElement('div');card.className='qa-question-card';
        card.innerHTML='<div class="qa-question-text">'+escapeHTML(q.text)+'</div><div class="qa-question-meta"><span>Asked by '+escapeHTML(q.userName)+'</span><span>'+escapeHTML(timeStr)+'</span>'+statusBadge+'<span class="qa-answer-count">💬 '+(q.answerCount||0)+' answers</span></div>';
        if(q.status==='approved')card.addEventListener('click',()=>openThread(qid,q));
        qaQuestionList.appendChild(card);
      });
    },err=>{console.error(err);qaQuestionList.innerHTML='<div class="qa-empty-state"><div class="icon">❓</div><p>Could not load questions.</p></div>';});
  }

  // Filter pills
  document.querySelectorAll('.qa-filter-pill').forEach(pill=>{
    pill.addEventListener('click',()=>{
      document.querySelectorAll('.qa-filter-pill').forEach(p=>p.classList.remove('active'));
      pill.classList.add('active');loadQuestions();
    });
  });

  // Open thread
  function openThread(qid,q){
    currentThreadId=qid;showThreadView();
    qaThreadTitle.textContent=q.text;qaThreadAuthor.textContent='Asked by '+q.userName;
    let timeStr='';if(q.createdAt)timeStr=q.createdAt.toDate().toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'});
    qaThreadTime.textContent=timeStr;
    qaThreadAnswerCount.textContent='💬 '+(q.answerCount||0)+' answers';
    loadAnswers(qid);
  }

  // Load answers
  function loadAnswers(qid){
    if(unsubAnswers)unsubAnswers();
    qaAnswersList.innerHTML='<div class="qa-empty-state"><div class="icon">?</div><p>Loading answers...</p></div>';
    unsubAnswers=db.collection('community_answers').where('questionId','==',qid).orderBy('createdAt','asc').limit(100)
    .onSnapshot(snap=>{
      if(snap.empty){qaAnswersList.innerHTML='<div class="qa-empty-state"><div class="icon">💬</div><p>No answers yet. Be the first to answer!</p></div>';return;}
      qaAnswersList.innerHTML='';
      snap.forEach(doc=>{
        const a=doc.data();
        let ts='Just now';if(a.createdAt)ts=a.createdAt.toDate().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
        const avatarHTML='<div class="message-avatar">'+escapeHTML((a.userName||'U').charAt(0).toUpperCase())+'</div>';
        const card=document.createElement('div');card.className='qa-answer-card';
        card.innerHTML=avatarHTML+'<div class="qa-answer-body"><div class="message-header"><span class="message-author">'+escapeHTML(a.userName)+'</span><span class="message-time">'+escapeHTML(ts)+'</span></div><div class="message-bubble">'+escapeHTML(a.text).replace(/\n/g,'<br>')+'</div></div>';
        qaAnswersList.appendChild(card);
      });
      setTimeout(()=>{qaAnswersList.scrollTop=qaAnswersList.scrollHeight;},100);
    },err=>{console.error(err);qaAnswersList.innerHTML='<div class="qa-empty-state"><div class="icon">⚠️</div><p>Could not load answers.</p></div>';});
  }

  // Send answer
  btnSendAnswer.addEventListener('click',sendAnswer);
  qaAnswerInput.addEventListener('keydown',(e)=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendAnswer();}});
  qaAnswerInput.addEventListener('input',function(){this.style.height='52px';this.style.height=Math.min(this.scrollHeight,120)+'px';});
  async function sendAnswer(){
    const text=qaAnswerInput.value.trim();
    if(!text||!currentUser||!currentThreadId)return;
    const name=currentUser.displayName||currentUser.email||'Anonymous';
    qaAnswerInput.value='';qaAnswerInput.style.height='52px';
    try{
      await db.collection('community_answers').add({questionId:currentThreadId,text,userId:currentUser.uid,userName:name,createdAt:firebase.firestore.FieldValue.serverTimestamp()});
      await db.collection('community_questions').doc(currentThreadId).update({answerCount:firebase.firestore.FieldValue.increment(1)});
    }catch(e){console.error(e);showToast('Error posting answer.');}
  }

  // Init
  switchChannel('general');
});

// Toggle Like
window.toggleLike=async function(messageId,hasLiked){
  const user=auth.currentUser;if(!user){if(typeof showAuthModal==='function')showAuthModal('login');return;}
  try{await db.collection('community_messages').doc(messageId).update({likes:hasLiked?firebase.firestore.FieldValue.arrayRemove(user.uid):firebase.firestore.FieldValue.arrayUnion(user.uid)});}
  catch(e){console.error(e);showToast('Error updating like.');}
};
// Delete Message
window.deleteMessage=async function(messageId){
  const user=auth.currentUser;if(!user)return;if(!confirm('Delete this message?'))return;
  try{const doc=await db.collection('community_messages').doc(messageId).get();
  if(!doc.exists){showToast('Message not found.');return;}
  if(doc.data().userId!==user.uid){showToast('You can only delete your own messages.');return;}
  await db.collection('community_messages').doc(messageId).delete();showToast('Message deleted.');}
  catch(e){console.error(e);showToast('Could not delete message.');}
};



(function(){
  const citizenLoginMarkup = '<div class="modalbox"><h2>Login Masyarakat</h2><p class="muted">Masuk tanpa username dan password. Tautan login akan dikirim ke email Anda.</p><div class="label">Email</div><input id="email" class="input" type="email" placeholder="nama@email.com"><div id="authMsg" class="notice info">Gunakan email aktif untuk menerima tautan login.</div><div class="actions"><button class="btn primary" onclick="passwordlessCitizenLogin()">Kirim tautan login</button><button class="btn outline" onclick="closeAuth()">Tutup</button></div></div>';

  window.openAuth = function(){
    const modal=document.getElementById('authModal');
    if(!modal) return;
    modal.innerHTML=citizenLoginMarkup;
    modal.classList.remove('hidden');
  };

  window.passwordlessCitizenLogin = async function(){
    const email=(document.getElementById('email')?.value||'').trim();
    if(!email) return setAuthMsg('Email wajib diisi.');
    const {error}=await db.auth.signInWithOtp({email,options:{emailRedirectTo:window.location.origin}});
    if(error) return setAuthMsg(error.message);
    setAuthMsg('Tautan login sudah dikirim. Buka email Anda untuk masuk.',true);
  };

  function setAuthMsg(text,good){
    const el=document.getElementById('authMsg');
    if(!el) return;
    el.className='notice '+(good?'good':'info');
    el.textContent=text;
  }

  window.showForm = function(type){
    q('home').classList.remove('hidden');
    q('info').classList.add('hidden');
    q('admin').classList.add('hidden');
    q('service').classList.remove('hidden');
    q('service').innerHTML='<h2>'+type+'</h2>'+
      '<div class="notice info"><b>Identitas pelapor</b><br>Isi identitas secara manual. Data ini tersimpan bersama laporan dan digunakan untuk verifikasi/tindak lanjut.</div>'+
      '<div class="label">Nama lengkap</div><input id="citizenName" class="input" placeholder="Nama sesuai identitas">'+
      '<div class="label">NIK</div><input id="citizenNik" class="input" inputmode="numeric" maxlength="16" placeholder="16 digit NIK">'+
      '<div class="label">Daerah / Domisili</div><input id="citizenRegion" class="input" placeholder="Contoh: Kota Bandung, Jawa Barat">'+
      '<div class="label">Judul laporan</div><input id="rTitle" class="input" placeholder="Contoh: Jalan rusak di depan pasar">'+
      '<div class="label">Kategori</div><select id="rCat" class="select">'+categories.map(x=>'<option>'+x+'</option>').join('')+'</select>'+ 
      '<div class="label">Tujuan routing</div><select id="rRoute" class="select">'+routings.map(x=>'<option>'+x+'</option>').join('')+'</select>'+ 
      '<div class="label">Isi laporan</div><textarea id="rBody" class="textarea" placeholder="Jelaskan laporan Anda"></textarea>'+ 
      '<div class="actions" style="margin-top:12px"><label><input id="rAnonymous" type="checkbox"> Anonim</label><label><input id="rConfidential" type="checkbox"> Rahasia</label></div>'+ 
      '<div class="actions" style="margin-top:12px"><button class="btn primary" onclick="submitReport(\''+type+'\')">Kirim</button><button class="btn outline" onclick="showHome()">Batal</button></div>';
  };

  window.submitReport = async function(type){
    const name=(q('citizenName')?.value||'').trim();
    const nik=(q('citizenNik')?.value||'').trim();
    const region=(q('citizenRegion')?.value||'').trim();
    const title=(q('rTitle')?.value||'').trim();
    const body=(q('rBody')?.value||'').trim();
    if(!name||!nik||!region||!title||!body) return alert('Nama, NIK, daerah, judul, dan isi laporan wajib diisi.');
    if(!/^\d{16}$/.test(nik)) return alert('NIK harus terdiri dari 16 digit angka.');
    const tracking=(type==='Pengaduan'?'LP':'AS')+'-2026-'+Math.floor(100000+Math.random()*900000);
    const payload={tracking_id:tracking,user_id:currentUser.id,report_type:type,title,body,category:q('rCat').value,routing:q('rRoute').value,is_anonymous:!!q('rAnonymous')?.checked,is_confidential:!!q('rConfidential')?.checked,citizen_name:name,citizen_nik:nik,citizen_region:region};
    const {data,error}=await db.from('reports').insert(payload).select().single();
    if(error) return alert(error.message);
    q('service').innerHTML='<div class="notice good"><b>Laporan tersimpan di Supabase.</b><br>Tracking ID: <b>'+data.tracking_id+'</b></div><div class="notice info"><b>Pelapor:</b> '+esc(name)+' · '+esc(region)+'<br><b>NIK:</b> '+maskNik(nik)+'</div><button class="btn primary" onclick="trackBy(\''+data.tracking_id+'\')">Lacak laporan</button>';
    q('track').value=tracking;
  };

  window.trackReport = async function(){
    if(!currentUser) return openAuth();
    const id=(q('track').value||'').trim();
    if(!id) return;
    const {data,error}=await db.from('reports').select('*,ratings(*)').eq('tracking_id',id).eq('user_id',currentUser.id).maybeSingle();
    if(error||!data) return q('trackResult').innerHTML='<div class="notice warn">Tracking ID tidak ditemukan atau bukan milik akun ini.</div>';
    let html='<div class="row"><b>'+esc(data.title)+'</b><div class="muted">'+data.tracking_id+' · '+data.report_type+' · '+data.category+'</div>';
    html+='<div class="notice info"><b>Identitas pelapor</b><br>'+esc(data.citizen_name||'-')+' · '+esc(data.citizen_region||'-')+'<br>NIK: '+maskNik(data.citizen_nik||'')+'</div>';
    html+='<p>'+esc(data.body)+'</p><span class="badge '+(data.status==='Selesai'?'good':'')+'">'+data.status+'</span>'+(data.admin_note?'<div class="notice good">Catatan admin: '+esc(data.admin_note)+'</div>':'');
    if(data.status==='Selesai') html+='<div class="notice info"><b>Nilai layanan</b><div class="stars" id="stars">'+[1,2,3,4,5].map(n=>'<button onclick="rateStar('+n+')" id="s'+n+'">★</button>').join('')+'</div><textarea id="review" class="textarea" placeholder="Ulasan Anda">'+esc(data.ratings?.[0]?.review||'')+'</textarea><button class="btn primary" onclick="saveRating(\''+data.id+'\')">Simpan penilaian</button></div>';
    html+='</div>'; q('trackResult').innerHTML=html; if(data.ratings?.[0]) rateStar(data.ratings[0].stars);
  };

  window.adminDash = async function(){
    if(currentProfile?.role!=='admin') return alert('Akses admin ditolak.');
    q('home').classList.add('hidden');q('service').classList.add('hidden');q('info').classList.add('hidden');q('admin').classList.remove('hidden');
    const {data,error}=await db.from('reports').select('*,profiles(full_name),ratings(*)').order('created_at',{ascending:false});
    if(error) return q('admin').innerHTML='<div class="notice warn">'+esc(error.message)+'</div>';
    const active=data.filter(r=>r.status!=='Selesai').length,done=data.filter(r=>r.status==='Selesai').length;
    q('admin').innerHTML='<div class="card"><button class="btn outline" onclick="showHome()">← Beranda</button><h2>Dashboard Admin</h2><div class="grid3"><div><div class="metric">'+data.length+'</div><div class="muted">Total laporan</div></div><div><div class="metric">'+active+'</div><div class="muted">Dalam proses</div></div><div><div class="metric">'+done+'</div><div class="muted">Selesai</div></div></div></div><div class="card"><h3>Semua laporan</h3>'+data.map(r=>'<div class="row"><b>'+esc(r.title)+'</b><div class="muted">'+r.tracking_id+' · '+esc(r.profiles?.full_name||'Masyarakat')+' · '+r.report_type+'</div><div class="notice info"><b>Identitas:</b> '+esc(r.citizen_name||'-')+' · '+esc(r.citizen_region||'-')+'<br><b>NIK:</b> '+esc(r.citizen_nik||'-')+'</div><span class="badge '+(r.status==='Selesai'?'good':'')+'">'+r.status+'</span><p>'+esc(r.body)+'</p>'+(r.status!=='Selesai'?'<button class="btn primary" onclick="completeReport(\''+r.id+'\')">Tandai selesai</button>':'<div class="notice good">Rating: '+(r.ratings?.[0]?.stars||'belum ada')+' / 5 · '+esc(r.ratings?.[0]?.review||'Belum ada ulasan')+'</div>')+'</div>').join('')+'</div>';
  };

  function maskNik(nik){ return nik ? nik.slice(0,4)+'********'+nik.slice(-4) : '-'; }
})();
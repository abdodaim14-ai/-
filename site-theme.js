(()=>{'use strict';
const URL='https://xkraqrjkimkdawlazjyl.supabase.co';
const KEY='sb_publishable_QXPRwlQsN2-5a-hy5ejKJA_2tmf7MJr';
function apply(d){
 if(!d||typeof d!=='object')return;
 const root=document.documentElement;
 const primary=d.theme_primary||d.themePrimary;
 const background=d.theme_background||d.themeBackground;
 if(typeof primary==='string'&&/^#[0-9a-f]{3,8}$/i.test(primary)){
  ['--gold-primary','--gold','--text-gold','--gold-light'].forEach(v=>root.style.setProperty(v,primary));
 }
 if(typeof background==='string'&&/^#[0-9a-f]{3,8}$/i.test(background)){
  ['--luxury-bg','--bg','--background'].forEach(v=>root.style.setProperty(v,background));
 }
 const font=d.font_data_url||d.design_data?.font_data_url;
 const fileName=String(d.font_file_name||d.design_data?.font_file_name||'').toLowerCase();
 const ext=(fileName.split('.').pop()||'').replace(/[^a-z0-9]/g,'');
 const formats={ttf:'truetype',otf:'opentype',woff:'woff',woff2:'woff2'};
 if(typeof font==='string'&&/^data:[^,]+;base64,/i.test(font)&&formats[ext]){
  let style=document.getElementById('daa-custom-font-style');
  if(!style){style=document.createElement('style');style.id='daa-custom-font-style';document.head.appendChild(style);}
  style.textContent='@font-face{font-family:"DaaCustomFont";src:url('+JSON.stringify(font)+') format("'+formats[ext]+'");font-display:swap}body,button,input,textarea,select{font-family:"DaaCustomFont",Tahoma,Arial,sans-serif!important}';
 }
}
function start(){
 if(!window.supabase?.createClient){
  if(document.getElementById('daa-supabase-loader'))return;
  const loader=document.createElement('script');loader.id='daa-supabase-loader';loader.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
  loader.onload=start;document.head.appendChild(loader);return;
 }
 const db=window.supabase.createClient(URL,KEY);
 db.rpc('get_public_site_design').then(({data,error})=>{
  if(error||!data)return;
  const d=data.design_data&&typeof data.design_data==='object'?{...data,...data.design_data}:data;
  apply(d);
 }).catch(()=>{});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
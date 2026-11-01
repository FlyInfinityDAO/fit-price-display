(function(){
  const section=document.getElementById('flyEcosystem');
  if(!section) return;
  if('IntersectionObserver' in window){
    const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{
      if(entry.isIntersecting){section.classList.add('eco-visible');observer.disconnect();}
    }),{threshold:.12});
    observer.observe(section);
  } else { section.classList.add('eco-visible'); }
})();

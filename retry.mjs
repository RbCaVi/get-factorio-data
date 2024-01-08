const Y=h=>(...args)=>h(h,...args);
const retryify=f=>Y((g,...args)=>f(...args).catch(g(g,...args)));
const retryifyAsync=f=>Y(async (g,...args)=>await (f(...args).catch(()=>g(g,...args))));

export {retryify,retryifyAsync};
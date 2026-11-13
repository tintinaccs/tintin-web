const {test,expect}=require('@playwright/test');
for(const [width,height] of [[320,568],[390,844],[844,390],[768,1024],[1024,768],[1440,900],[1920,1080]]) {
  test(`editorial de relojes muestra la foto completa sin desbordar a ${width}px`,async({page})=>{
    await page.setViewportSize({width,height});
    // Aislar la geometría del HTML y CSS reales de datos remotos y personalizaciones.
    await page.route('**/*',route=>{
      const request=route.request();
      if(request.resourceType()==='script') return route.fulfill({contentType:'text/javascript',body:''});
      if(new URL(request.url()).hostname!=='127.0.0.1') return route.abort();
      return route.continue();
    });
    await page.goto('/');
    const section=page.locator('.tt-watch-feature');
    await section.scrollIntoViewIfNeeded();
    await section.locator('img').evaluate(img=>img.decode());
    const geometry=await section.evaluate(el=>{
      const rect=el.getBoundingClientRect(),img=el.querySelector('img'),imageRect=img.getBoundingClientRect(),content=el.querySelector('.tt-watch-feature-content');
      return {left:rect.left,right:rect.right,overflow:el.scrollWidth-el.clientWidth,contentOverflow:content.scrollWidth-content.clientWidth,ratio:imageRect.width/imageRect.height,fit:getComputedStyle(img).objectFit,src:img.currentSrc};
    });
    expect(geometry.left).toBeGreaterThanOrEqual(0);
    expect(geometry.right).toBeLessThanOrEqual(width);
    expect(geometry.overflow).toBeLessThanOrEqual(1);
    expect(geometry.contentOverflow).toBeLessThanOrEqual(1);
    expect(geometry.ratio).toBeCloseTo(1086/1448,2);
    expect(geometry.fit).toBe('contain');
    expect(geometry.src).toContain('/coleccion-tintin.webp?v=coleccion-20261113-1');
  });
}

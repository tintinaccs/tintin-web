const {expect}=require('@playwright/test');
// Keep every file unchanged while explicitly following the real selection → editor → review flow.
async function confirmPhotoEdits(page,count=1){
 for(let i=0;i<count;i++){
  const dialog=page.getByRole('dialog',{name:'Editar fotografía',exact:true});await expect(dialog).toBeVisible();
  const title=await dialog.getAttribute('aria-labelledby');await dialog.getByRole('button',{name:'Aplicar edición',exact:true}).click();
  await expect(page.locator('#'+title)).toHaveCount(0);
 }
}
module.exports={confirmPhotoEdits};

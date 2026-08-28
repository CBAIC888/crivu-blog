const items = [
  ['藍色彈珠','1972 · 地球','阿波羅十七號拍攝的地球。現代漢語中的「世界」，常常首先令人想到這顆完整的星球。','Earth: NASA/Apollo 17, AS17-148-22727 · Public Domain','blue-marble.webp'],
  ['犍陀羅坐佛','一世紀至二世紀中葉 · 犍陀羅','佛教進入漢地以前，已經沿著跨地域交通與語言網絡傳播。造像僅作時代與文化背景。','The Metropolitan Museum of Art, 2003.593.1 · CC0','gandhara-buddha.webp'],
  ['安世高','人物復原示意','安世高約於東漢桓帝時期來到洛陽譯經。現存材料沒有可靠的寫生肖像。','生成圖像 · 人物復原示意，不作為歷史肖像證據','an-shigao-reconstruction.webp'],
  ['支婁迦讖','人物復原示意','支婁迦讖來自月氏，約於二世紀後期在洛陽從事譯經。','生成圖像 · 人物復原示意，不作為歷史肖像證據','lokaksema-reconstruction.webp'],
  ['東漢譯經協作','歷史重構示意','外國僧人誦出或口授，通曉不同語言者轉譯，漢地參與者筆錄、校訂。','生成圖像 · 歷史重構示意，不作為現場記錄','eastern-han-translation-workshop.webp'],
  ['中國世界地圖','約1800年 · 地圖','十九世紀前後的世界圖景，處於傳統地理秩序與全球知識逐漸交接的時刻。','Library of Congress · Public Domain Mark','chinese-world-map-1800.webp'],
  ['玄奘像','人物畫','玄奘所譯《阿毗達磨俱舍論》保存了小千、中千與大千世界的層級說明。','The Metropolitan Museum of Art · CC0','xuanzang-portrait.webp'],
  ['馬禮遜像','十九世紀 · 中西譯詞','馬禮遜一八二二年出版的《華英字典》，已在 world 條目下列出「世界」。','Attributed to George Chinnery · Public Domain','robert-morrison-portrait.webp'],
  ['《後漢書·西域傳》原頁','佛教初傳記載','「世傳明帝夢見金人」說明至遲在五世紀，正史已收錄這則後世傳說。','《後漢書·西域傳》錄文頁','book-of-later-han-western-regions.webp'],
  ['《後漢書·楚王英傳》原頁','永平八年 · 公元65年','詔書中的「伊蒲塞」與「桑門」，提供了較具體的早期佛教活動材料。','《後漢書·楚王英傳》錄文頁','book-of-later-han-prince-ying.webp'],
  ['馬禮遜《華英字典》WORLD 條','1822 · 辭書原頁','world 條下已列出「地球」「普天下」「世間」「世界」等中文表達。','Robert Morrison · Public Domain scan','morrison-dictionary-world-entry.webp'],
  ['羅存德《英華字典》WORLD 條','1866—1869 · 辭書原頁','羅存德在 world 條下並列「世」「世界」「天下」「寰宇」等譯詞。','Wilhelm Lobscheid · Public Domain scan','lobscheid-dictionary-world-entry.webp'],
  ['《從「天下」「萬國」到「世界」》首頁','2006 · 研究論文','金觀濤、劉青峰以近代中文文獻詞頻討論晚清政治語言中的「世界」轉折。','《二十一世紀》總第94期','tianxia-wanguo-shijie-paper.webp'],
  ['「天下、萬國、世界」詞頻段落','1830—1926 · 語料趨勢','論文所述趨勢顯示，一八九五年後「世界」使用增加。','金觀濤、劉青峰論文節錄','tianxia-wanguo-shijie-frequency.webp'],
  ['Nattier 早期漢譯佛典研究','2008 · 研究文獻','Jan Nattier 對東漢、三國早期漢譯佛典及傳統譯者署名進行系統辨析。','A Guide to the Earliest Chinese Buddhist Translations','nattier-early-translations.webp'],
  ['早期中國佛經譯者研究','2015 · 翻譯史研究','研究討論早期譯經者、參與者及翻譯程序。','Early Chinese Buddhist Translators','early-chinese-buddhist-translators.webp'],
  ['支婁迦讖譯詞表首頁','2011 · 譯詞研究','Karashima 的譯詞表幫助核對早期漢譯中 loka、lokadhātu 等詞語。','Seishi Karashima, A Glossary of Lokakṣema’s Translation','karashima-lokaksema-glossary.webp'],
];

const english = new URLSearchParams(location.search).get('lang') === 'en';
if (english) {
  document.documentElement.lang = 'en';
  document.querySelector('[data-gallery-back]').textContent = '← Back to article';
  document.querySelector('[data-gallery-back]').href = '/preview/research-en.html';
  document.querySelector('[data-gallery-label]').textContent = 'Image gallery';
  document.querySelector('[data-gallery-title]').innerHTML = 'An Exploration of <i>Shijie</i> 世界';
  document.querySelector('[data-gallery-deck]').textContent = 'Images and documentary sources from the article are preserved here. Select an image for full-screen viewing.';
}

const grid = document.querySelector('[data-gallery-grid]');
grid.innerHTML = items.map((item,index) => `<figure class="gallery-card"><button class="gallery-image" type="button" data-gallery-index="${index}" aria-label="${english ? 'Enlarge' : '放大查看'}：${item[0]}"><img src="/preview/assets/world-gallery/${item[4]}" alt="${item[0]}" loading="lazy" decoding="async"></button><figcaption><h2>${item[0]}</h2><p class="gallery-meta">${item[1]}</p><p class="gallery-caption">${item[2]}</p><small>${item[3]}</small></figcaption></figure>`).join('');

const lightbox = document.querySelector('[data-gallery-lightbox]');
const image = document.querySelector('[data-gallery-lightbox-image]');
const caption = document.querySelector('[data-gallery-lightbox-caption]');
let current = 0;
const show = (index) => {
  current = (index + items.length) % items.length;
  image.src = `/preview/assets/world-gallery/${items[current][4]}`;
  image.alt = items[current][0];
  caption.textContent = `${String(current+1).padStart(2,'0')} / ${items.length} · ${items[current][0]}`;
};
grid.addEventListener('click',(event) => { const button=event.target.closest('[data-gallery-index]'); if(!button)return; show(Number(button.dataset.galleryIndex)); lightbox.showModal(); });
document.querySelector('[data-gallery-close]').addEventListener('click',()=>lightbox.close());
document.querySelector('[data-gallery-prev]').addEventListener('click',()=>show(current-1));
document.querySelector('[data-gallery-next]').addEventListener('click',()=>show(current+1));
lightbox.addEventListener('click',(event)=>{ if(event.target===lightbox) lightbox.close(); });
document.addEventListener('keydown',(event)=>{ if(!lightbox.open)return; if(event.key==='ArrowLeft')show(current-1); if(event.key==='ArrowRight')show(current+1); });

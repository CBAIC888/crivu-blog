(function () {
  if (typeof CMS === 'undefined') return;

  var escapeHtml = function (input) {
    return String(input == null ? '' : input)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  };

  CMS.registerEditorComponent({
    id: 'image-block',
    label: '圖片（含尺寸建議）',
    fields: [
      { name: 'src', label: '圖片', widget: 'image' },
      { name: 'alt', label: '替代文字', widget: 'string', required: false },
      {
        name: 'preset',
        label: '尺寸預設',
        widget: 'select',
        default: 'article',
        options: [
          { label: '封面橫圖 1600x1000', value: 'cover-1600x1000' },
          { label: '文內橫圖 1200x800', value: 'article-1200x800' },
          { label: '社群直圖 1080x1350', value: 'portrait-1080x1350' }
        ]
      },
      { name: 'caption', label: '圖片說明', widget: 'string', required: false }
    ],
    pattern: /!\[(.*?)\]\((.*?)\)\n<!--\s*preset:(.*?)\s*-->\n?(?:\*(.*?)\*)?/,
    fromBlock: function (match) {
      return {
        alt: match[1] || '',
        src: match[2] || '',
        preset: match[3] || 'article-1200x800',
        caption: match[4] || ''
      };
    },
    toBlock: function (obj) {
      var alt = obj.alt || '';
      var src = obj.src || '';
      var preset = obj.preset || 'article-1200x800';
      var caption = obj.caption ? '\n*' + obj.caption + '*' : '';
      return '![' + alt + '](' + src + ')\n<!-- preset:' + preset + ' -->' + caption;
    },
    toPreview: function (obj) {
      var caption = obj.caption ? '<figcaption>' + escapeHtml(obj.caption) + '</figcaption>' : '';
      return '<figure><img src="' + escapeHtml(obj.src || '') + '" alt="' + escapeHtml(obj.alt || '') + '"/>' + caption + '</figure>';
    }
  });
})();

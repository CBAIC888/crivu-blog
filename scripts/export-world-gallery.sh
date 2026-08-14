#!/bin/sh
set -eu

output_dir="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)/src/assets/world-gallery"
source_root="${1:-${CRIVU_WORLD_SOURCE_ROOT:-}}"
[ -n "$source_root" ] || {
  echo "usage: $0 /absolute/path/to/world-project-source" >&2
  exit 2
}
[ -d "$source_root" ] || {
  echo "source directory does not exist: $source_root" >&2
  exit 2
}
mkdir -p "$output_dir"

convert_image() {
  source_file="$1"
  output_file="$2"
  /opt/homebrew/bin/cwebp -quiet -q 82 -resize 0 2200 "$source_root/$source_file" -o "$output_dir/$output_file"
}

convert_image "素材/B_公版圖像/B01_藍色彈珠_NASA_Apollo17_1972.jpg" "world-01.webp"
convert_image "素材/B_公版圖像/B02_犍陀羅坐佛_TheMet_2003.593.1_CC0.jpg" "world-02.webp"
convert_image "素材/H_生成補景/安世高1.png" "world-03.webp"
convert_image "素材/H_生成補景/支娄迦谶2.png" "world-04.webp"
convert_image "素材/H_生成補景/H03_東漢譯經協作_歷史重構示意.png" "world-05.webp"
convert_image "素材/B_公版圖像/B03_約1800中國世界地圖_LoC.jpg" "world-06.webp"
convert_image "素材/B_公版圖像/B07_玄奘像_TheMet_CC0.jpg" "world-07.webp"
convert_image "素材/B_公版圖像/B08_馬禮遜像_GeorgeChinnery_公版.jpg" "world-08.webp"
convert_image "素材/D_文獻原頁/D01_後漢書_西域傳_世傳夢金人.png" "world-09.webp"
convert_image "素材/D_文獻原頁/D02_後漢書_楚王英傳_伊蒲塞桑門.png" "world-10.webp"
convert_image "素材/D_文獻原頁/D25b_馬禮遜華英字典_WORLD原頁_1822.png" "world-11.webp"
convert_image "素材/D_文獻原頁/D26c_羅存德英華字典_WORLD原頁_1866-1869.png" "world-12.webp"
convert_image "素材/D_文獻原頁/D27a_天下萬國世界_論文首頁.png" "world-13.webp"
convert_image "素材/D_文獻原頁/D27b_天下萬國世界_詞頻段落.png" "world-14.webp"
convert_image "素材/D_文獻原頁/D28a_Nattier_論文首頁.png" "world-15.webp"
convert_image "素材/D_文獻原頁/D33a_早期中國佛經譯者_論文首頁.png" "world-16.webp"
convert_image "素材/D_文獻原頁/D34a_Karashima_詞表首頁.png" "world-17.webp"

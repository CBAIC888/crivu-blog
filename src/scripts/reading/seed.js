// @ts-check
import { STORAGE_KEYS } from './types.js';
import { readStore, writeStore } from './storage.js';

const day = (offset) => {
  const value = new Date();
  value.setDate(value.getDate() + offset);
  value.setHours(20, 0, 0, 0);
  return value.toISOString();
};
const yearDate = (month, date) => {
  const value = new Date();
  value.setMonth(month, date);
  value.setHours(19, 0, 0, 0);
  return value.toISOString();
};

export const ensureSeedData = () => {
  if (readStore(STORAGE_KEYS.seeded, false)) return;
  /** @type {import('./types.js').Book[]} */
  const books = [
    { id:'siddhartha', title:'悉達多', author:'赫曼・赫塞', publisher:'天津人民出版社', publishedDate:'2017-01-01', isbn10:'', isbn13:'9787201112695', coverUrl:'', coverSource:'placeholder', googleBooksId:'', openLibraryId:'', totalPages:224, status:'reading', rating:null, createdAt:day(-34), updatedAt:day(0) },
    { id:'lost-country', title:'迷蹤之國', author:'天下霸唱', publisher:'安徽文藝出版社', publishedDate:'2009-06-01', isbn10:'', isbn13:'9787539631271', coverUrl:'', coverSource:'placeholder', googleBooksId:'', openLibraryId:'', totalPages:320, status:'reading', rating:null, createdAt:day(-10), updatedAt:day(-2) },
    { id:'norwegian-wood', title:'挪威的森林', author:'村上春樹', publisher:'上海譯文出版社', publishedDate:'2018-03-01', isbn10:'', isbn13:'9787532776771', coverUrl:'', coverSource:'placeholder', googleBooksId:'', openLibraryId:'', totalPages:398, status:'reading', rating:null, createdAt:day(-22), updatedAt:day(-4) },
    { id:'tender-is-night', title:'溫柔的夜', author:'三毛', publisher:'北京十月文藝出版社', publishedDate:'2017-03-01', isbn10:'', isbn13:'9787530214770', coverUrl:'', coverSource:'placeholder', googleBooksId:'', openLibraryId:'', totalPages:240, status:'finished', rating:4.5, createdAt:yearDate(7,12), updatedAt:day(-2) },
    { id:'one-hundred-years', title:'百年孤獨', author:'加西亞・馬爾克斯', publisher:'南海出版公司', publishedDate:'2017-08-01', isbn10:'', isbn13:'9787544291170', coverUrl:'', coverSource:'placeholder', googleBooksId:'', openLibraryId:'', totalPages:360, status:'finished', rating:5, createdAt:yearDate(2,2), updatedAt:yearDate(3,18) },
    { id:'the-stranger', title:'局外人', author:'阿爾貝・卡繆', publisher:'上海譯文出版社', publishedDate:'2010-08-01', isbn10:'', isbn13:'9787532751471', coverUrl:'', coverSource:'placeholder', googleBooksId:'', openLibraryId:'', totalPages:128, status:'finished', rating:4, createdAt:yearDate(0,8), updatedAt:yearDate(1,15) },
    { id:'moon-and-sixpence', title:'月亮與六便士', author:'威廉・薩默塞特・毛姆', publisher:'上海譯文出版社', publishedDate:'2018-04-01', isbn10:'', isbn13:'9787532777556', coverUrl:'', coverSource:'placeholder', googleBooksId:'', openLibraryId:'', totalPages:312, status:'want_to_read', rating:null, createdAt:day(-4), updatedAt:day(-4) },
  ];
  /** @type {import('./types.js').ReadingProgress[]} */
  const progress = [
    { bookId:'siddhartha', currentPage:186, totalPages:224, startedAt:day(-34), finishedAt:null, lastReadAt:day(0) },
    { bookId:'lost-country', currentPage:92, totalPages:320, startedAt:day(-10), finishedAt:null, lastReadAt:day(-2) },
    { bookId:'norwegian-wood', currentPage:144, totalPages:398, startedAt:day(-22), finishedAt:null, lastReadAt:day(-4) },
    { bookId:'tender-is-night', currentPage:240, totalPages:240, startedAt:yearDate(7,12), finishedAt:day(-2), lastReadAt:day(-2) },
    { bookId:'one-hundred-years', currentPage:360, totalPages:360, startedAt:yearDate(2,2), finishedAt:yearDate(3,18), lastReadAt:yearDate(3,18) },
    { bookId:'the-stranger', currentPage:128, totalPages:128, startedAt:yearDate(0,8), finishedAt:yearDate(1,15), lastReadAt:yearDate(1,15) },
    { bookId:'moon-and-sixpence', currentPage:0, totalPages:312, startedAt:null, finishedAt:null, lastReadAt:null },
  ];
  writeStore(STORAGE_KEYS.books, books);
  writeStore(STORAGE_KEYS.progress, progress);
  writeStore(STORAGE_KEYS.seeded, true);
};

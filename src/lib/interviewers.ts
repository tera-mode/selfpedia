import { Interviewer } from '@/types';

export const INTERVIEWERS: Interviewer[] = [
  {
    id: 'female_01',
    gender: '女性',
    character: 'かわいい・親しみやすい',
    tone: '丁寧だけどフレンドリー',
    description: '明るく親しみやすい雰囲気で、あなたの魅力を引き出します',
  },
  {
    id: 'male_01',
    gender: '男性',
    character: 'かっこいい・知的',
    tone: '落ち着いた敬語',
    description: '落ち着いた雰囲気で、あなたの深い部分まで掘り下げます',
  },
];

export const getInterviewer = (id: string): Interviewer | undefined => {
  return INTERVIEWERS.find((interviewer) => interviewer.id === id);
};

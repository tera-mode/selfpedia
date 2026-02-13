import { UserTrait, TraitCategory, TRAIT_CATEGORY_LABELS } from '@/types/trait';

export function formatTraitsForPrompt(traits: UserTrait[]): string {
  return traits.map((trait) => {
    let line = `- ${trait.label}（カテゴリ: ${TRAIT_CATEGORY_LABELS[trait.category]}）`;
    if (trait.intensityLabel) {
      line += `【${trait.intensityLabel}】`;
    }
    if (trait.description) {
      line += `: ${trait.description}`;
    }
    if (trait.keywords.length > 0) {
      line += ` [キーワード: ${trait.keywords.join(', ')}]`;
    }
    return line;
  }).join('\n');
}

export function getCategoryBreakdown(traits: UserTrait[]): string {
  const breakdown: Partial<Record<TraitCategory, number>> = {};
  traits.forEach(t => {
    breakdown[t.category] = (breakdown[t.category] || 0) + 1;
  });
  return Object.entries(breakdown)
    .map(([cat, count]) => `${TRAIT_CATEGORY_LABELS[cat as TraitCategory]}: ${count}個`)
    .join(', ');
}

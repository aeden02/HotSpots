// Tag names come from the AI (ai/server.py TAG_PROFILES).
export const TAGS = [
    { tag: 'food-and-drink', label: 'Food & drink' },
    { tag: 'outdoors', label: 'Outdoors' },
    { tag: 'history', label: 'History' },
    { tag: 'arts-and-culture', label: 'Arts & culture' },
    { tag: 'shopping', label: 'Shopping' },
    { tag: 'entertainment', label: 'Entertainment' },
    { tag: 'family-activities', label: 'Family activities' },
    { tag: 'sports-and-fitness', label: 'Sports & fitness' },
    { tag: 'nightlife', label: 'Nightlife' },
    { tag: 'education', label: 'Learning' },
    { tag: 'wellness', label: 'Wellness' },
    { tag: 'lodging', label: 'Lodging' },
]

// "food-and-drink" -> "Food & drink". Unknown tags are shown as they are.
export function tagLabel(tag){
    return TAGS.find((t) => t.tag === tag)?.label ?? tag
}
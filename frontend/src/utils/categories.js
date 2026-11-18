const LABEL = {
    food: 'Food',
    attractions: 'Attractions', 
    outdoors: 'Outdoors',
    shops: 'Shops', 
}

export function categoryLabel(category){
    return LABEL[category] ?? category
}
const LABEL = {
    food: 'Food',
    attractions: 'Attractions', 
    outdoors: 'Outdoors',
    shops: 'Shops', 
}

export function categoryLabel(category){
    return LABEL[category] ?? category
}

export function cityName(cityId){
    return cityId.split('-')
                 .map((word)=>word[0].toUpperCase() + word.slice(1))
                 .join(' ')
}
// Ingredients: values per 100 g (or 100 ml), typical UK supermarket labels, rounded.
// Flags drive the hard diet rules. 'meat' is set to the type of meat.
// unit: how to count it on the shopping list. pantry: listed without amounts.

export const SHOP_GROUPS = ['Meat and fish', 'Dairy and eggs', 'Plant protein', 'Bread, grains and potatoes', 'Fruit and veg', 'Tins and jars', 'Cupboard'];

export const INGREDIENTS = {
  chicken: { name: 'Chicken breast', kcal: 106, p: 24, c: 0, f: 1.1, meat: 'chicken', shop: 'Meat and fish' },
  'chicken-thigh': { name: 'Chicken thigh fillets', kcal: 140, p: 19, c: 0, f: 7, meat: 'chicken', shop: 'Meat and fish' },
  'beef-mince': { name: 'Beef mince (5% fat)', kcal: 124, p: 21, c: 0, f: 4.5, meat: 'beef', shop: 'Meat and fish' },
  lamb: { name: 'Lean diced lamb', kcal: 150, p: 21, c: 0, f: 7, meat: 'lamb', shop: 'Meat and fish' },
  salmon: { name: 'Salmon fillets', kcal: 210, p: 20.5, c: 0, f: 14, fish: true, shop: 'Meat and fish' },
  tuna: { name: 'Tuna in spring water', kcal: 109, p: 25, c: 0, f: 0.8, fish: true, shop: 'Tins and jars', unit: { one: 'tin', many: 'tins', g: 112, list: true } },

  eggs: { name: 'Eggs', kcal: 140, p: 12.6, c: 0.4, f: 9.5, egg: true, shop: 'Dairy and eggs', unit: { one: 'egg', many: 'eggs', g: 50, count: true } },
  'greek-yog': { name: 'Fat-free Greek-style yogurt', kcal: 57, p: 10, c: 4, f: 0.2, dairy: true, shop: 'Dairy and eggs' },
  milk: { name: 'Semi-skimmed milk', kcal: 50, p: 3.6, c: 4.8, f: 1.8, dairy: true, shop: 'Dairy and eggs', ml: true },
  cheddar: { name: 'Mature cheddar', kcal: 416, p: 25, c: 0.1, f: 34.9, dairy: true, shop: 'Dairy and eggs' },
  cottage: { name: 'Reduced-fat cottage cheese', kcal: 72, p: 11.1, c: 3.1, f: 1.5, dairy: true, shop: 'Dairy and eggs' },
  paneer: { name: 'Paneer', kcal: 321, p: 20, c: 3, f: 25, dairy: true, shop: 'Dairy and eggs' },
  feta: { name: 'Feta', kcal: 264, p: 16, c: 1, f: 21, dairy: true, shop: 'Dairy and eggs' },
  whey: { name: 'Whey protein powder', kcal: 390, p: 78, c: 6, f: 6, dairy: true, shop: 'Cupboard', unit: { one: 'scoop', many: 'scoops', g: 30, count: true, of: 'whey protein', list: true } },

  'soya-milk': { name: 'Unsweetened soya drink', kcal: 33, p: 3.3, c: 0.2, f: 1.8, soy: true, shop: 'Plant protein', ml: true },
  'pea-protein': { name: 'Pea protein powder', kcal: 375, p: 80, c: 2, f: 6, shop: 'Cupboard', unit: { one: 'scoop', many: 'scoops', g: 30, count: true, of: 'pea protein', list: true } },
  tofu: { name: 'Firm tofu', kcal: 125, p: 13, c: 1.5, f: 7.2, soy: true, shop: 'Plant protein' },
  lentils: { name: 'Red lentils (dried)', kcal: 318, p: 24, c: 48, f: 1.3, shop: 'Plant protein' },
  chickpeas: { name: 'Chickpeas (tinned, drained)', kcal: 120, p: 7.2, c: 13.5, f: 2.6, shop: 'Tins and jars', unit: { one: 'tin', many: 'tins', g: 240, list: true } },
  'kidney-beans': { name: 'Kidney beans (tinned, drained)', kcal: 100, p: 7, c: 13.5, f: 0.5, shop: 'Tins and jars', unit: { one: 'tin', many: 'tins', g: 240, list: true } },
  'baked-beans': { name: 'Baked beans', kcal: 78, p: 4.7, c: 12.5, f: 0.2, shop: 'Tins and jars', unit: { one: 'tin', many: 'tins', g: 415, list: true } },

  oats: { name: 'Porridge oats', kcal: 374, p: 11, c: 60, f: 8, gluten: true, shop: 'Bread, grains and potatoes' },
  bread: { name: 'Wholemeal bread', kcal: 235, p: 10, c: 40, f: 2.8, gluten: true, shop: 'Bread, grains and potatoes', unit: { one: 'slice', many: 'slices', g: 40, count: true, of: 'wholemeal bread', list: true } },
  wrap: { name: 'Wholemeal wraps', kcal: 287, p: 8.5, c: 45, f: 6.6, gluten: true, shop: 'Bread, grains and potatoes', unit: { one: 'wholemeal wrap', many: 'wholemeal wraps', g: 62, count: true } },
  rice: { name: 'Basmati rice (dry)', kcal: 355, p: 8.1, c: 78, f: 0.9, shop: 'Bread, grains and potatoes' },
  pasta: { name: 'Wholewheat pasta (dry)', kcal: 343, p: 13, c: 63, f: 2.5, gluten: true, shop: 'Bread, grains and potatoes' },
  potatoes: { name: 'Potatoes', kcal: 77, p: 2, c: 17, f: 0.1, shop: 'Bread, grains and potatoes' },
  'sweet-potato': { name: 'Sweet potatoes', kcal: 86, p: 1.6, c: 20, f: 0.1, shop: 'Bread, grains and potatoes' },
  'rice-cakes': { name: 'Rice cakes', kcal: 387, p: 8, c: 80, f: 3, shop: 'Bread, grains and potatoes', unit: { one: 'rice cake', many: 'rice cakes', g: 8, count: true } },

  'frozen-veg': { name: 'Frozen mixed veg', kcal: 50, p: 2.8, c: 7, f: 0.6, shop: 'Fruit and veg' },
  broccoli: { name: 'Broccoli', kcal: 34, p: 4, c: 3, f: 0.6, shop: 'Fruit and veg' },
  spinach: { name: 'Spinach', kcal: 25, p: 2.8, c: 1.6, f: 0.8, shop: 'Fruit and veg' },
  peppers: { name: 'Peppers', kcal: 26, p: 1, c: 5, f: 0.3, shop: 'Fruit and veg', unit: { one: 'pepper', many: 'peppers', g: 160 } },
  onion: { name: 'Onions', kcal: 36, p: 1.2, c: 7.9, f: 0.2, shop: 'Fruit and veg', unit: { one: 'onion', many: 'onions', g: 150 } },
  salad: { name: 'Salad leaves', kcal: 20, p: 1.5, c: 2, f: 0.4, shop: 'Fruit and veg' },
  banana: { name: 'Bananas', kcal: 95, p: 1.2, c: 20.3, f: 0.3, shop: 'Fruit and veg', unit: { one: 'banana', many: 'bananas', g: 100, count: true } },
  berries: { name: 'Frozen mixed berries', kcal: 40, p: 1, c: 7.5, f: 0.3, shop: 'Fruit and veg' },
  apple: { name: 'Apples', kcal: 50, p: 0.4, c: 11.5, f: 0.1, shop: 'Fruit and veg', unit: { one: 'apple', many: 'apples', g: 150, count: true } },
  'tomatoes-tin': { name: 'Chopped tomatoes', kcal: 21, p: 1.2, c: 3.5, f: 0.2, shop: 'Tins and jars', unit: { one: 'tin', many: 'tins', g: 400, list: true } },

  pb: { name: 'Peanut butter', kcal: 600, p: 25, c: 12, f: 49, nuts: true, shop: 'Cupboard' },
  almonds: { name: 'Almonds', kcal: 610, p: 21, c: 7, f: 54, nuts: true, shop: 'Cupboard' },
  'olive-oil': { name: 'Olive oil', kcal: 884, p: 0, c: 0, f: 100, shop: 'Cupboard' },
  honey: { name: 'Honey', kcal: 330, p: 0.4, c: 82, f: 0, honey: true, shop: 'Cupboard' },
  hummus: { name: 'Hummus', kcal: 290, p: 7, c: 10, f: 24, sesame: true, shop: 'Plant protein' },

  // Pantry staples: listed as "check you have", no amounts, negligible calories
  garlic: { name: 'Garlic', kcal: 0, p: 0, c: 0, f: 0, pantry: true, shop: 'Cupboard' },
  'curry-spices': { name: 'Curry powder or garam masala', kcal: 0, p: 0, c: 0, f: 0, pantry: true, shop: 'Cupboard' },
  'chilli-spices': { name: 'Chilli powder and cumin', kcal: 0, p: 0, c: 0, f: 0, pantry: true, shop: 'Cupboard' },
  paprika: { name: 'Smoked paprika', kcal: 0, p: 0, c: 0, f: 0, pantry: true, shop: 'Cupboard' },
  herbs: { name: 'Dried mixed herbs', kcal: 0, p: 0, c: 0, f: 0, pantry: true, shop: 'Cupboard' },
  lemon: { name: 'Lemon', kcal: 0, p: 0, c: 0, f: 0, pantry: true, shop: 'Fruit and veg' },
};

// Meals: one portion. items are [ingredient id, grams]. The planner scales portions to hit your calories.
export const MEALS = [
  // Breakfast
  { id: 'protein-oats', slot: 'breakfast', name: 'Protein porridge', mins: 5, items: [['oats', 50], ['milk', 250], ['whey', 30], ['banana', 100]], how: 'Cook the oats in the milk for 3 to 4 minutes. Take off the heat, stir in the protein powder and top with sliced banana.' },
  { id: 'vegan-oats', slot: 'breakfast', name: 'Overnight oats', mins: 5, items: [['oats', 60], ['soya-milk', 220], ['pea-protein', 25], ['berries', 100]], how: 'Mix everything in a jar the night before and leave it in the fridge.' },
  { id: 'eggs-toast', slot: 'breakfast', name: 'Scrambled eggs on toast', mins: 10, items: [['eggs', 150], ['bread', 80], ['spinach', 50], ['olive-oil', 5]], how: 'Wilt the spinach in the oil, add the beaten eggs and stir gently until just set. Serve on toast.' },
  { id: 'yogurt-bowl', slot: 'breakfast', name: 'Greek yogurt bowl', mins: 3, items: [['greek-yog', 250], ['berries', 100], ['banana', 100], ['honey', 10]], how: 'Spoon the yogurt into a bowl and top with the fruit and honey.' },
  { id: 'tofu-scramble', slot: 'breakfast', name: 'Tofu scramble and potatoes', mins: 20, items: [['tofu', 200], ['potatoes', 200], ['spinach', 50], ['peppers', 80], ['olive-oil', 10]], pantry: ['garlic', 'paprika'], how: 'Pan-fry diced potatoes until golden. Crumble the tofu into the pan with the peppers, paprika and spinach and cook until hot.' },
  { id: 'eggs-beans', slot: 'breakfast', name: 'Eggs and beans on toast', mins: 10, items: [['eggs', 100], ['baked-beans', 200], ['bread', 40]], how: 'Poach or fry the eggs, warm the beans and serve on toast.' },
  { id: 'omelette', slot: 'breakfast', name: 'Cheese and veg omelette', mins: 10, items: [['eggs', 150], ['cheddar', 20], ['peppers', 80], ['onion', 40], ['spinach', 30], ['olive-oil', 5]], how: 'Soften the veg in the oil, pour in the beaten eggs, add the cheese and fold.' },
  { id: 'pb-toast-milk', slot: 'breakfast', name: 'Peanut butter toast and milk', mins: 5, items: [['bread', 80], ['pb', 20], ['banana', 100], ['milk', 300]], how: 'Toast the bread, spread with peanut butter and top with banana. Glass of milk on the side.' },
  { id: 'berry-smoothie', slot: 'breakfast', name: 'Berry protein smoothie', mins: 3, items: [['pea-protein', 35], ['banana', 120], ['berries', 120]], how: 'Blend with water and a few ice cubes until smooth.' },

  // Lunch
  { id: 'chicken-rice', slot: 'lunch', name: 'Chicken, rice and broccoli', mins: 20, items: [['chicken', 150], ['rice', 75], ['broccoli', 100], ['olive-oil', 7]], pantry: ['garlic', 'paprika'], how: 'Season and pan-fry the chicken, cook the rice and steam the broccoli.' },
  { id: 'tuna-wraps', slot: 'lunch', name: 'Tuna wraps', mins: 5, items: [['tuna', 112], ['wrap', 124], ['greek-yog', 40], ['salad', 40]], how: 'Mix the tuna with the yogurt and black pepper, then fill the wraps with tuna and salad.' },
  { id: 'chickpea-feta', slot: 'lunch', name: 'Chickpea and feta salad', mins: 5, items: [['chickpeas', 200], ['feta', 50], ['peppers', 80], ['salad', 50], ['olive-oil', 10]], pantry: ['lemon'], how: 'Toss everything with the oil and a squeeze of lemon.' },
  { id: 'lentil-soup', slot: 'lunch', name: 'Red lentil and sweet potato soup', mins: 30, items: [['lentils', 90], ['tomatoes-tin', 200], ['onion', 80], ['sweet-potato', 150], ['olive-oil', 5]], pantry: ['garlic', 'curry-spices'], how: 'Soften the onion and garlic, add the spices, lentils, diced sweet potato, tomatoes and 600 ml water. Simmer for 20 minutes and blend if you like.' },
  { id: 'burrito-bowl', slot: 'lunch', name: 'Beef burrito bowl', mins: 20, items: [['beef-mince', 125], ['kidney-beans', 100], ['rice', 60], ['peppers', 80], ['onion', 50], ['cheddar', 20]], pantry: ['chilli-spices'], how: 'Brown the mince with the onion, peppers and spices, then add the beans. Serve over rice with the cheese.' },
  { id: 'egg-potato-salad', slot: 'lunch', name: 'Egg and potato salad', mins: 20, items: [['eggs', 150], ['potatoes', 250], ['greek-yog', 50], ['salad', 50]], pantry: ['herbs'], how: 'Boil the potatoes and eggs, let them cool, mix with the yogurt and herbs and serve on the leaves.' },
  { id: 'salmon-potatoes', slot: 'lunch', name: 'Salmon, potatoes and greens', mins: 25, items: [['salmon', 130], ['potatoes', 250], ['broccoli', 100]], pantry: ['lemon'], how: 'Bake the salmon at 200°C for 15 minutes, boil the potatoes and steam the broccoli.' },
  { id: 'tofu-hummus-wraps', slot: 'lunch', name: 'Tofu and hummus wraps', mins: 10, items: [['wrap', 124], ['hummus', 40], ['tofu', 150], ['salad', 40], ['peppers', 50]], pantry: ['paprika'], how: 'Fry sliced tofu with paprika, then fill the wraps with hummus, tofu, peppers and salad.' },
  { id: 'chicken-pasta', slot: 'lunch', name: 'Chicken and tomato pasta', mins: 20, items: [['pasta', 75], ['chicken', 130], ['tomatoes-tin', 150], ['spinach', 50], ['olive-oil', 7]], pantry: ['garlic', 'herbs'], how: 'Cook the pasta. Fry the chicken, add garlic, tomatoes and herbs, then stir in the spinach and pasta.' },
  { id: 'tofu-rice-bowl', slot: 'lunch', name: 'Tofu, rice and veg bowl', mins: 20, items: [['tofu', 200], ['rice', 70], ['broccoli', 100], ['peppers', 80], ['olive-oil', 7]], pantry: ['garlic', 'chilli-spices'], how: 'Cook the rice, fry cubed tofu until golden, stir-fry the veg and combine.' },
  { id: 'jacket-beans', slot: 'lunch', name: 'Jacket potato with beans and cheese', mins: 12, items: [['potatoes', 300], ['baked-beans', 200], ['cheddar', 30]], how: 'Microwave the potato for 8 to 10 minutes and top with hot beans and cheese.' },
  { id: 'jacket-tuna', slot: 'lunch', name: 'Jacket potato with tuna', mins: 12, items: [['potatoes', 300], ['tuna', 112], ['greek-yog', 50], ['salad', 40]], how: 'Microwave the potato for 8 to 10 minutes and top with tuna mixed with yogurt. Salad on the side.' },

  // Dinner
  { id: 'chicken-curry', slot: 'dinner', name: 'Chicken curry and rice', mins: 35, items: [['chicken-thigh', 180], ['tomatoes-tin', 200], ['onion', 100], ['greek-yog', 50], ['rice', 75], ['olive-oil', 10]], pantry: ['garlic', 'curry-spices'], how: 'Fry the onion and garlic, add the spices and chicken, then the tomatoes. Simmer for 20 minutes and stir in the yogurt off the heat. Serve with rice.' },
  { id: 'beef-chilli', slot: 'dinner', name: 'Beef chilli and rice', mins: 35, items: [['beef-mince', 150], ['kidney-beans', 120], ['tomatoes-tin', 200], ['onion', 80], ['peppers', 80], ['rice', 70]], pantry: ['garlic', 'chilli-spices'], how: 'Brown the mince with the onion and peppers, add the spices, tomatoes and beans and simmer for 20 minutes.' },
  { id: 'salmon-sweet-potato', slot: 'dinner', name: 'Salmon, sweet potato and broccoli', mins: 35, items: [['salmon', 150], ['sweet-potato', 250], ['broccoli', 120], ['olive-oil', 5]], pantry: ['paprika'], how: 'Roast sweet potato wedges at 200°C for 30 minutes, adding the salmon for the last 15. Steam the broccoli.' },
  { id: 'dal', slot: 'dinner', name: 'Red lentil dal and rice', mins: 30, items: [['lentils', 90], ['tomatoes-tin', 150], ['onion', 80], ['spinach', 80], ['rice', 60], ['olive-oil', 10]], pantry: ['garlic', 'curry-spices'], how: 'Soften the onion, garlic and spices, add the lentils, tomatoes and 500 ml water and simmer for 20 minutes. Stir in the spinach and serve with rice.' },
  { id: 'paneer-curry', slot: 'dinner', name: 'Paneer and chickpea curry', mins: 25, items: [['paneer', 100], ['chickpeas', 120], ['tomatoes-tin', 150], ['spinach', 80], ['rice', 60], ['olive-oil', 5]], pantry: ['garlic', 'curry-spices'], how: 'Brown cubed paneer, then simmer with the spices, tomatoes and chickpeas for 15 minutes. Stir in the spinach and serve with rice.' },
  { id: 'lamb-stew', slot: 'dinner', name: 'Lamb and vegetable stew', mins: 60, items: [['lamb', 150], ['potatoes', 250], ['frozen-veg', 150], ['tomatoes-tin', 150], ['onion', 60]], pantry: ['garlic', 'herbs'], how: 'Brown the lamb with the onion, add everything else with 300 ml water and simmer for 45 minutes until tender.' },
  { id: 'tofu-stir-fry', slot: 'dinner', name: 'Tofu stir-fry with rice', mins: 20, items: [['tofu', 200], ['frozen-veg', 200], ['rice', 70], ['olive-oil', 10]], pantry: ['garlic', 'chilli-spices'], how: 'Fry the tofu until golden, add the veg and garlic and toss with the cooked rice.' },
  { id: 'bolognese', slot: 'dinner', name: 'Beef bolognese', mins: 30, items: [['beef-mince', 130], ['pasta', 80], ['tomatoes-tin', 200], ['onion', 60], ['cheddar', 15]], pantry: ['garlic', 'herbs'], how: 'Brown the mince with the onion and garlic, add the tomatoes and herbs and simmer for 20 minutes. Serve on pasta with the cheese.' },
  { id: 'egg-fried-rice', slot: 'dinner', name: 'Egg fried rice', mins: 15, items: [['eggs', 150], ['rice', 75], ['frozen-veg', 150], ['olive-oil', 10]], pantry: ['garlic'], how: 'Use cold cooked rice. Fry the veg and garlic, push them aside, scramble the eggs, then toss everything together.' },
  { id: 'chicken-fajitas', slot: 'dinner', name: 'Chicken fajita wraps', mins: 20, items: [['chicken', 160], ['wrap', 124], ['peppers', 100], ['onion', 60], ['greek-yog', 40]], pantry: ['chilli-spices', 'paprika'], how: 'Fry sliced chicken, peppers and onion with the spices. Serve in the wraps with yogurt.' },
  { id: 'bean-chilli', slot: 'dinner', name: 'Bean chilli with sweet potato', mins: 40, items: [['kidney-beans', 150], ['lentils', 40], ['tomatoes-tin', 200], ['peppers', 80], ['onion', 60], ['sweet-potato', 250]], pantry: ['garlic', 'chilli-spices'], how: 'Bake the sweet potato. Simmer everything else with 250 ml water for 25 minutes.' },
  { id: 'chicken-traybake', slot: 'dinner', name: 'Chicken and potato traybake', mins: 45, items: [['chicken-thigh', 180], ['potatoes', 300], ['peppers', 100], ['onion', 60], ['olive-oil', 8]], pantry: ['garlic', 'paprika', 'herbs'], how: 'Toss everything in the oil and spices and roast at 200°C for 35 to 40 minutes.' },

  // Snacks
  { id: 'yogurt-berries', slot: 'snack', name: 'Greek yogurt and berries', mins: 2, items: [['greek-yog', 200], ['berries', 80]], how: 'Top the yogurt with the berries.' },
  { id: 'whey-shake', slot: 'snack', name: 'Protein shake with milk', mins: 1, items: [['whey', 30], ['milk', 250]], how: 'Shake the powder with cold milk.' },
  { id: 'pea-shake', slot: 'snack', name: 'Pea protein shake and a banana', mins: 1, items: [['pea-protein', 30], ['banana', 100]], how: 'Shake the powder with water. Banana on the side.' },
  { id: 'pb-toast', slot: 'snack', name: 'Peanut butter toast', mins: 3, items: [['bread', 40], ['pb', 15]], how: 'Toast and spread.' },
  { id: 'cottage-ricecakes', slot: 'snack', name: 'Cottage cheese on rice cakes', mins: 2, items: [['cottage', 150], ['rice-cakes', 24]], how: 'Spread the cottage cheese on the rice cakes and add black pepper.' },
  { id: 'boiled-eggs', slot: 'snack', name: 'Two boiled eggs', mins: 10, items: [['eggs', 100]], how: 'Boil for 8 minutes and cool in cold water.' },
  { id: 'apple-almonds', slot: 'snack', name: 'Apple and almonds', mins: 1, items: [['apple', 150], ['almonds', 25]], how: 'Slice the apple and eat with a small handful of almonds.' },
  { id: 'hummus-peppers', slot: 'snack', name: 'Hummus and pepper sticks', mins: 3, items: [['hummus', 60], ['peppers', 100]], how: 'Slice the pepper into sticks and dip.' },
  { id: 'milk-banana', slot: 'snack', name: 'Milk and a banana', mins: 1, items: [['milk', 300], ['banana', 100]], how: 'A big glass of milk and a banana.' },
  { id: 'tuna-ricecakes', slot: 'snack', name: 'Tuna on rice cakes', mins: 3, items: [['tuna', 80], ['rice-cakes', 24], ['greek-yog', 20]], how: 'Mix the tuna with the yogurt and pile onto the rice cakes.' },
  { id: 'roast-chickpeas', slot: 'snack', name: 'Crunchy roast chickpeas', mins: 25, items: [['chickpeas', 150], ['olive-oil', 5]], pantry: ['paprika'], how: 'Pat dry, toss in oil and paprika and roast at 200°C for 20 to 25 minutes.' },
  { id: 'soya-banana', slot: 'snack', name: 'Soya milk and a banana', mins: 1, items: [['soya-milk', 300], ['banana', 100]], how: 'A big glass of soya drink and a banana.' },
];

export const SLOTS = [
  { id: 'breakfast', name: 'Breakfast' },
  { id: 'lunch', name: 'Lunch' },
  { id: 'dinner', name: 'Dinner' },
  { id: 'snack', name: 'Snack' },
];

// Things people can leave out, mapped to ingredient flags
export const AVOID_OPTIONS = [
  { id: 'nuts', name: 'Nuts and peanuts' },
  { id: 'dairy', name: 'Dairy' },
  { id: 'egg', name: 'Eggs' },
  { id: 'gluten', name: 'Gluten' },
  { id: 'fish', name: 'Fish' },
  { id: 'soy', name: 'Soy' },
  { id: 'sesame', name: 'Sesame' },
];

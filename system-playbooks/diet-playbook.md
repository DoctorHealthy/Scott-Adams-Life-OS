# Diet System Playbook

This is what a "system" means in this app. Not a checkbox. A plan that removes the decisions, tells you what to buy and how to prep, sets exact targets, and gets out of your way. The check-in just logs whether you ran it. The coach adapts it.

The app should deliver this as the Diet system's detail page: targets at the top, today's meals, the eating window, the shopping list, and the prep. Numbers are computed in code, never by the AI.

## The idea (why this works)

Adams' rule: take willpower out of eating. You don't white-knuckle a diet, you engineer it so the easy choice is the right one. Three moves do the work:

1. Keep a short menu of default meals so there's no daily "what do I eat" decision.
2. Make the energizing food the most convenient thing in your kitchen.
3. Cut the simple carbs that make you sluggish (white bread, white rice, big plain-potato portions), lean on protein, complex carbs, fruit, fish.

You also have two hard constraints baked in: lactose-free, and low added sugar (diabetes risk). Both are handled in the menu below.

## Your targets (computed in code from your stats)

At 22, 188 cm, 88 kg, training most days:

- Maintenance: about 3,100 kcal
- Lean-gain target: about 3,350 kcal (this is your default, since you want muscle, not weight loss)
- Protein: about 170 g per day
- Added sugar: keep low, favor whole-food carbs and fiber
- Fats: fill the rest, lean on olive oil, nuts, eggs, fish

The app recalculates these if your weight or activity changes. The coach reads these numbers, it never guesses them.

## The eating window (no fasting)

Two to three real meals, spaced about 4 to 5 hours apart, front-loaded earlier in the day, last meal well before bed instead of 10pm. This ties straight into the sleep system: a late heavy dinner wrecks your sleep, so the window pulls dinner earlier as your wake time moves earlier.

A normal day, roughly:

- Meal 1, late morning or early afternoon (around when you wake during the shift): the biggest, highest-protein meal.
- Meal 2, mid-afternoon before or during early work: solid protein and complex carbs.
- Meal 3, early evening, well before bed: lighter, protein-forward, lower carb.

Hit roughly 1,050 to 1,150 kcal per meal to land near 3,350.

## Your default meal menu (Hofer, Billa, Spar, air-fryer fast)

Pick 5 or 6 of these to rotate. All lactose-free, low added sugar, fast to prep. Macros are approximate, the app totals the exact numbers from what you log.

1. **Air-fryer chicken thighs + sweet potato + broccoli.** ~700 kcal, ~50 g protein. Chicken and cubed sweet potato in the air fryer, frozen broccoli steamed. Olive oil, salt, paprika.
2. **Salmon fillet + rice + spinach.** ~680 kcal, ~42 g protein. Air-fryer salmon, microwave rice pouch, wilted spinach in olive oil.
3. **Beef or turkey mince stir-fry + frozen veg + rice.** ~720 kcal, ~46 g protein. One pan, 12 minutes. Soy sauce, garlic, no added sugar sauces.
4. **4 eggs scrambled + wholegrain bread + avocado + tomato.** ~600 kcal, ~30 g protein. Your morning anchor, upgraded from the ham sandwich.
5. **Lactose-free high-protein yogurt + oats + berries + nuts.** ~520 kcal, ~35 g protein (use a high-protein lactose-free yogurt, Hofer and Billa both carry one). Fast, gut-friendly, low sugar if you skip the sweetened kinds.
6. **Canned tuna + potatoes + big mixed salad + olive oil.** ~560 kcal, ~40 g protein. No cooking beyond boiling potatoes, or air-fry potato cubes.
7. **Chicken sausage (low-sugar) + lentils + roasted veg.** ~620 kcal, ~42 g protein. One tray, air fryer plus a pouch of pre-cooked lentils.
8. **Lactose-free cottage cheese + fruit + nuts.** ~400 kcal, ~30 g protein. A fast third meal or a top-up to hit protein.

Swap the pre-cooked Hofer lunch trays for these. They're barely more effort and they stop the sluggish feeling you mentioned.

## Weekly shopping list (the app generates this from your picked meals)

Grouped by section so it's a fast in-and-out.

- **Protein:** chicken thighs or breast, salmon fillets, mince (beef or turkey), eggs, canned tuna, low-sugar chicken sausage, lactose-free high-protein yogurt, lactose-free cottage cheese.
- **Carbs:** sweet potatoes, potatoes, microwave rice pouches, rolled oats, wholegrain bread, pre-cooked lentils.
- **Veg and fruit:** frozen broccoli, frozen mixed veg, spinach, salad mix, tomatoes, avocado, berries, apples, bananas.
- **Fats and extras:** olive oil, mixed nuts, garlic, paprika, soy sauce, salt.

Hofer for the cheap staples, Billa for anything Hofer doesn't have that week.

## How the app runs it (the build)

- The Diet detail page shows: your targets, today's planned meals from your menu, the eating window with times, and a "shopping list" button that builds the list from your selected meals.
- The check-in logs what you actually ate against the menu (tap the meals, or quick-add). Code totals calories and protein and shows you against target. The AI never does this math.
- The coach reads the totals and the trend, then nudges: "You're 30 g under protein three days running, add the cottage cheese meal," or "dinner is landing at 9pm, pull it to 7." Concrete, from your data.
- Setup flow the first time: you pick your 5 or 6 meals, set your window times, done. After that it runs with almost no input.

## One honest note

This is general nutrition guidance tuned to your goals, not medical advice. Given the diabetes risk, if you make a big change or your numbers move, run it past your doctor. The low-sugar, protein-forward, whole-food approach here is the safe default either way.

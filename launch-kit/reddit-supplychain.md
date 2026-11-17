# r/supplychain

**Title:** I made a free site with 93 supply chain calculators, each one tested against independently written code. Looking for people to try to break it.

**Body:**

I'm a supply chain and analytics student, and I got tired of calculator sites that give you one formula per page, bury it under ads, and never say which convention they use. So I built Lotwise: lotwise.io

It covers EOQ and price breaks, safety stock (demand, lead time, and both), reorder points, fill rate, newsvendor, periodic review, forecasting and forecast error, MRP and lot sizing, landed cost, center of gravity, queuing, SPC, critical path and crashing, and a lot more. 93 in total.

A few things I tried to get right:

You ask it a question in plain words ("I keep running out of stock") and it routes you to the right model. The answer comes first as a sentence, then what it means in dollars and days, then two or three things to do. The full math is one click away.

Units convert for you. Daily demand with a lead time in weeks just works, and it tells you what it converted. A week counts as 5 days if you set a 250-day working year.

Where textbooks disagree, it says so and lets you switch. Holding cost as $/unit or as a % of cost. Tracking signal sign convention. Whether M/M/s waiting cost is charged on time in line or time in system. Table z (1.65) versus exact z (1.645).

The Plan Builder takes a CSV of sales history and gives every SKU a forecast method, safety stock, reorder point, and order quantity. The Excel export keeps every calculated number as a live formula, so you can change the holding rate in the workbook and watch the whole plan update.

On accuracy: every calculator has to reproduce textbook examples, match a separately written Python implementation across 2,000 randomized cases each (2.3 million values compared in total, zero mismatches), and, where the formula makes a real-world claim, pass a simulation. The results are public on the Verified page. Before launch I also had an independent review of 36 calculators, and it caught two real errors: an aggregate plan that let shortages go uncharged, and a lead-time standard deviation that got rescaled when it shouldn't have. Both are fixed and covered by tests now.

Every calculator is free with no account. There's a paid tier ($12 a month) for the Plan Builder, Excel and PDF exports, and what-if sliders. I'm saying that up front because I'd rather you know.

What I'd love from this sub: tell me where a result disagrees with how you do it at work, and which calculator you went looking for that isn't there. Searches that find nothing get logged (no personal info), and that list is my roadmap.

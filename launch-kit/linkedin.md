# LinkedIn post

In my supply chain classes I kept running into the same problem: the formulas are simple, but using them correctly isn't. Units get mixed, every textbook writes the same equation with different symbols, and most calculator sites never tell you which convention they picked.

So I built Lotwise, a set of 93 supply chain and operations calculators: inventory, forecasting, capacity, queuing, quality, MRP, logistics, sourcing, finance, project management, and decision analysis.

You can describe the problem in plain words and it finds the right model. In Business mode you get the answer as a sentence, what it means in dollars and days, and what to do next. In Learner mode you get every step, the table lookups, and the mistakes that cost points on exams, in your textbook's notation.

The part I spent the most time on is trust. Every calculator has to reproduce textbook examples, match an independently written Python version across thousands of random inputs, and pass a simulation when the formula makes a real-world claim. An independent review still found two errors before launch, which is exactly why I wanted one. Both are fixed, and the full test results are public.

Every calculator is free. If you work in planning, purchasing, or operations, I'd value ten minutes of you trying to break it: lotwise.io

# r/operations

**Title:** Free operations calculators that show the method, not just the number: queuing, capacity, OEE, line balancing, SPC, critical path (93 in total)

**Body:**

I built Lotwise (lotwise.io) because I wanted one place where the operations formulas I use for school and work are correct, explained, and quick to run on my own numbers.

The ops side covers Little's Law, takt time, bottleneck analysis, utilization and effective capacity, OEE, line balancing, learning curves, M/M/1, M/M/s with a cost-optimal staffing search, M/D/1, Kingman's approximation for general arrivals, X-bar and R charts, p and c charts, Cp and Cpk, DPMO, cost of quality, CPM, PERT, and project crashing solved as a linear program.

Some details that matter to me:

The queuing pages run a live simulation next to the formula, so you can watch the line build as utilization climbs past 85%.

M/M/s staffing cost can charge waiting on time in line or time in system. Textbooks split on this, and the cheapest number of servers can change depending on which you pick, so it's a setting instead of a hidden assumption.

Line balancing and part-period balancing are heuristics, and the site says that. The line balancing simulation reports how often the heuristic finds the true minimum number of stations on small lines (95% of the time in testing) instead of pretending it's always optimal.

There are two modes on the same engine. Business mode gives a plain answer and what to do about it. Learner mode shows every substitution, the table lookups, and common exam mistakes, in Heizer, Chopra, Cachon, or Jacobs notation.

Every formula is checked three ways: textbook examples, randomized comparison against a separate Python implementation, and simulation where the formula claims something about the real world. The full results are on the Verified page.

It's free to use with no account. If you run operations for a living, I'd really like to hear which numbers you'd check first before trusting a tool like this, and what's missing.

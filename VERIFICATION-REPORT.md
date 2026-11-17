# Lotwise Verification Report

Generated 2026-11-17 07:04 UTC by `npm run verify`. This file and the public Verified page are built from the same test run (`verification/report.json`).

## Result

**93 of 93 calculators pass every verification layer.**

| Layer | What it checks | Result |
|---|---|---|
| 1. Worked examples | Textbook-style problems with known answers, matched to the stated precision | 187 of 187 pass |
| 2. Independent reference | A separate Python implementation (numpy, scipy, statsmodels) run on randomized inputs | 186,000 cases, 2,348,859 values compared, 0 mismatches |
| 3. Simulation proof | Monte Carlo, discrete-event simulation, and brute-force search for every calculator that makes a real-world claim | 30 of 30 suites pass, 146,520,764 simulated trials, covering 42 calculators |
| Property tests | Monotonicity, limits, identities, edge cases, malformed input | 514 of 514 pass |
| Catalog tests | Search, wizards reach every calculator, practice problems, problem parser | 69 of 69 pass |

## How to read this

- **Layer 1** uses the stated precision of each expected answer: 16.5 must match to one decimal, 200 must match exactly.
- **Layer 2** tolerance is 1e-9 relative. Two calculators that pass through an iterative solver use a slightly wider tolerance (fill rate 1e-7, crashing 1e-6). Inputs include randomized time units and every mode switch, so unit conversion and conventions are compared too.
- **Layer 3** never uses the formula under test. Where a formula is itself an approximation (Kingman, PERT completion probability, combined safety stock), the tolerance is stated and the actual gap is shown.
- Calculators that are definitions or accounting identities (for example inventory turnover or DSO) have no simulation because there is nothing random to simulate. They are verified by layers 1 and 2 and by property tests.

Environment: Python 3.13.18, numpy 2.5.3, scipy 1.18.1, statsmodels 0.15.0, Node v22.23.4.

## Summary by calculator

| Calculator | Examples | Cross-check cases | Values compared | Property tests | Simulation | Status |
|---|---|---|---|---|---|---|
| Economic Order Quantity (EOQ) | 2/2 | 2,000 | 18,000 | 13/13 | pass | Verified |
| Total Annual Inventory Cost | 2/2 | 2,000 | 18,000 | 6/6 | n/a | Verified |
| Production Order Quantity (EPQ / POQ) | 2/2 | 2,000 | 20,000 | 7/7 | pass | Verified |
| Quantity Discount Model (All-Units) | 2/2 | 2,000 | 20,001 | 6/6 | pass | Verified |
| EOQ with Planned Backorders | 2/2 | 2,000 | 18,000 | 8/8 | pass | Verified |
| Number of Orders per Year | 2/2 | 2,000 | 6,000 | 5/5 | n/a | Verified |
| Time Between Orders | 2/2 | 2,000 | 6,000 | 5/5 | n/a | Verified |
| Reorder Point (Constant Demand) | 2/2 | 2,000 | 4,000 | 7/7 | n/a | Verified |
| Safety Stock: Variable Demand | 2/2 | 2,000 | 10,000 | 13/13 | pass | Verified |
| Safety Stock: Variable Lead Time | 2/2 | 2,000 | 10,000 | 6/6 | pass | Verified |
| Safety Stock: Variable Demand and Lead Time | 2/2 | 2,000 | 18,000 | 8/8 | pass | Verified |
| Cycle Service Level | 2/2 | 2,000 | 12,000 | 7/7 | pass | Verified |
| Fill Rate and Expected Shortage per Cycle | 2/2 | 2,000 | 18,000 | 9/9 | pass | Verified |
| Newsvendor (Single-Period) Model | 2/2 | 2,000 | 22,000 | 8/8 | pass | Verified |
| Periodic Review (Order-Up-To Level) | 2/2 | 2,000 | 12,000 | 9/9 | pass | Verified |
| Continuous Review (s, Q) Policy | 2/2 | 2,000 | 22,000 | 6/6 | pass | Verified |
| Risk Pooling (Square-Root Law) | 2/2 | 2,000 | 14,000 | 8/8 | pass | Verified |
| Inventory Turnover | 2/2 | 2,000 | 6,000 | 6/6 | n/a | Verified |
| Days of Supply (DIO) | 2/2 | 2,000 | 6,000 | 5/5 | n/a | Verified |
| Average Inventory | 2/2 | 2,000 | 6,000 | 5/5 | n/a | Verified |
| Holding (Carrying) Cost | 2/2 | 2,000 | 8,000 | 5/5 | n/a | Verified |
| ABC Classification | 2/2 | 2,000 | 65,714 | 5/5 | n/a | Verified |
| GMROI (Gross Margin Return on Inventory) | 2/2 | 2,000 | 8,000 | 5/5 | n/a | Verified |
| Simple Moving Average | 2/2 | 2,000 | 32,916 | 6/6 | n/a | Verified |
| Weighted Moving Average | 2/2 | 2,000 | 30,029 | 3/3 | n/a | Verified |
| Exponential Smoothing | 2/2 | 2,000 | 40,981 | 5/5 | pass | Verified |
| Trend-Adjusted Exponential Smoothing (Holt) | 2/2 | 2,000 | 95,905 | 5/5 | pass | Verified |
| Seasonal Indices | 2/2 | 2,000 | 40,733 | 5/5 | n/a | Verified |
| Holt-Winters (Trend and Seasonality) | 3/3 | 2,000 | 48,496 | 5/5 | n/a | Verified |
| Linear Regression / Trend Projection | 2/2 | 2,000 | 22,000 | 6/6 | pass | Verified |
| Mean Absolute Deviation (MAD) | 2/2 | 2,000 | 57,592 | 3/3 | n/a | Verified |
| Mean Squared Error (MSE) | 2/2 | 2,000 | 58,612 | 3/3 | n/a | Verified |
| Mean Absolute Percent Error (MAPE) | 2/2 | 2,000 | 59,394 | 3/3 | n/a | Verified |
| Forecast Bias | 2/2 | 2,000 | 58,114 | 3/3 | n/a | Verified |
| Tracking Signal | 2/2 | 2,000 | 57,490 | 7/7 | n/a | Verified |
| Little's Law | 2/2 | 2,000 | 8,000 | 4/4 | pass | Verified |
| Takt Time | 2/2 | 2,000 | 8,000 | 5/5 | n/a | Verified |
| Process Cycle Time and Flow Time | 2/2 | 2,000 | 15,950 | 3/3 | n/a | Verified |
| Throughput Rate | 2/2 | 2,000 | 10,000 | 5/5 | n/a | Verified |
| Bottleneck Identification | 2/2 | 2,000 | 31,817 | 6/6 | n/a | Verified |
| Capacity Utilization | 2/2 | 2,000 | 4,000 | 5/5 | n/a | Verified |
| Efficiency | 2/2 | 2,000 | 4,000 | 5/5 | n/a | Verified |
| Effective Capacity and Expected Output | 2/2 | 2,000 | 6,000 | 6/6 | n/a | Verified |
| Overall Equipment Effectiveness (OEE) | 2/2 | 2,000 | 10,000 | 5/5 | n/a | Verified |
| Assembly Line Balancing | 2/2 | 2,000 | 28,218 | 5/5 | pass | Verified |
| Learning Curve | 2/2 | 2,000 | 8,000 | 8/8 | n/a | Verified |
| Break-Even Analysis for Capacity | 2/2 | 2,000 | 12,000 | 8/8 | n/a | Verified |
| M/M/1 Queue (Single Server) | 2/2 | 2,000 | 14,000 | 7/7 | pass | Verified |
| M/M/s Queue (Multiple Servers, Erlang C) | 2/2 | 2,000 | 18,000 | 8/8 | pass | Verified |
| M/D/1 Queue (Constant Service Time) | 2/2 | 2,000 | 14,000 | 6/6 | pass | Verified |
| Kingman's Approximation (VUT) | 2/2 | 2,000 | 16,000 | 8/8 | pass | Verified |
| Queue Probabilities: Waiting and Number in System | 2/2 | 2,000 | 40,828 | 6/6 | pass | Verified |
| X-bar and R Control Charts | 2/2 | 2,000 | 75,397 | 6/6 | pass | Verified |
| p-Chart (Fraction Defective) | 2/2 | 2,000 | 46,724 | 5/5 | pass | Verified |
| c-Chart (Count of Defects) | 2/2 | 2,000 | 20,240 | 3/3 | pass | Verified |
| Process Capability (Cp and Cpk) | 2/2 | 2,000 | 12,000 | 8/8 | pass | Verified |
| DPMO and Sigma Level | 2/2 | 2,000 | 10,000 | 7/7 | n/a | Verified |
| Cost of Quality | 2/2 | 2,000 | 10,000 | 5/5 | n/a | Verified |
| Taguchi Loss Function | 2/2 | 2,000 | 6,000 | 6/6 | pass | Verified |
| MRP Gross-to-Net Requirements | 2/2 | 2,000 | 74,112 | 6/6 | pass | Verified |
| Lot-for-Lot Lot Sizing | 2/2 | 2,000 | 58,090 | 4/4 | pass | Verified |
| Fixed Order Quantity (EOQ) Lot Sizing | 2/2 | 2,000 | 59,625 | 3/3 | pass | Verified |
| Periodic Order Quantity (POQ) Lot Sizing | 2/2 | 2,000 | 62,126 | 3/3 | pass | Verified |
| Part-Period Balancing | 2/2 | 2,000 | 59,808 | 3/3 | pass | Verified |
| Aggregate Planning: Chase vs Level vs Hybrid | 2/2 | 2,000 | 26,000 | 5/5 | pass | Verified |
| Landed Cost | 2/2 | 2,000 | 10,000 | 7/7 | n/a | Verified |
| Center of Gravity Method | 2/2 | 2,000 | 8,000 | 5/5 | pass | Verified |
| Load-Distance Method | 2/2 | 2,000 | 10,959 | 3/3 | n/a | Verified |
| Factor Rating Method | 2/2 | 2,000 | 20,000 | 3/3 | n/a | Verified |
| Location Break-Even Analysis | 2/2 | 2,000 | 23,176 | 3/3 | n/a | Verified |
| Freight Cost per Unit and per CWT | 2/2 | 2,000 | 14,000 | 5/5 | n/a | Verified |
| Cube and Weight Utilization | 2/2 | 2,000 | 12,000 | 4/4 | n/a | Verified |
| In-Transit Inventory and Mode Trade-Off | 2/2 | 2,000 | 28,000 | 5/5 | n/a | Verified |
| Total Cost of Ownership (TCO) | 2/2 | 2,000 | 18,002 | 3/3 | n/a | Verified |
| Weighted Supplier Scorecard | 2/2 | 2,000 | 22,000 | 3/3 | n/a | Verified |
| Make vs Buy | 2/2 | 2,000 | 12,000 | 6/6 | n/a | Verified |
| Price Break Analysis | 2/2 | 2,000 | 25,044 | 3/3 | n/a | Verified |
| Cash-to-Cash Cycle | 2/2 | 2,000 | 10,000 | 6/6 | n/a | Verified |
| Days Sales Outstanding (DSO) | 2/2 | 2,000 | 6,000 | 5/5 | n/a | Verified |
| Days Payable Outstanding (DPO) | 2/2 | 2,000 | 6,000 | 5/5 | n/a | Verified |
| Supply Chain DuPont Model (ROA) | 2/2 | 2,000 | 10,000 | 6/6 | n/a | Verified |
| Perfect Order Rate | 2/2 | 2,000 | 6,000 | 6/6 | n/a | Verified |
| OTIF (On Time In Full) | 2/2 | 2,000 | 8,000 | 6/6 | n/a | Verified |
| Order, Line, and Unit Fill Rate | 2/2 | 2,000 | 6,000 | 4/4 | n/a | Verified |
| Bullwhip Ratio | 2/2 | 2,000 | 12,000 | 5/5 | n/a | Verified |
| Critical Path Method (CPM) | 2/2 | 2,000 | 90,132 | 5/5 | pass | Verified |
| PERT Expected Time and Variance | 2/2 | 2,000 | 118,896 | 5/5 | pass | Verified |
| Probability of Completing by a Deadline | 2/2 | 2,000 | 8,000 | 6/6 | pass | Verified |
| Project Crashing | 2/2 | 2,000 | 22,031 | 6/6 | pass | Verified |
| Expected Monetary Value (EMV) | 2/2 | 2,000 | 20,907 | 6/6 | pass | Verified |
| Decision Tree | 2/2 | 2,000 | 6,000 | 5/5 | pass | Verified |
| Expected Value of Perfect Information (EVPI) | 2/2 | 2,000 | 20,973 | 3/3 | pass | Verified |
| Maximax, Maximin, and Minimax Regret | 2/2 | 2,000 | 75,827 | 5/5 | n/a | Verified |

## Simulation results

### Brute-force search: no order quantity has a lower total cost than the EOQ

Calculators: eoq. Trials: 250. Result: pass.

250 random demand, ordering-cost and holding-cost combinations. Total cost was evaluated at every whole-unit order quantity up to four times the EOQ.

| Check | Predicted | Simulated | OK |
|---|---|---|---|
| Cases where some grid quantity beat the EOQ cost, or the cheapest grid quantity was more than 1 unit from the EOQ | 0 | 0 | yes |
| Largest gap between best whole-unit cost and EOQ cost (relative) | 0 | 1.54192e-05 | yes |

### Brute-force search: no batch size has a lower cost than the production order quantity

Calculators: epq. Trials: 250. Result: pass.

250 random cases. Setup plus holding cost was evaluated at every whole-unit batch size up to four times the answer.

| Check | Predicted | Simulated | OK |
|---|---|---|---|
| Cases where a grid batch size beat the answer | 0 | 0 | yes |
| Largest relative gap to the best whole-unit cost | 0 | 4.24429e-05 | yes |

### Brute-force search over the whole price schedule

Calculators: quantity-discount. Trials: 200. Result: pass.

200 random price schedules with 2 to 4 tiers. Total annual cost (purchase + ordering + holding) was evaluated on a half-unit grid plus every break quantity.

| Check | Predicted | Simulated | OK |
|---|---|---|---|
| Cases where a grid quantity was cheaper than the answer | 0 | 0 | yes |
| Largest relative gap to the best grid cost | 0 | 5.79672e-08 | yes |

### Numerical optimisation over order size and backorder level

Calculators: backorder-eoq. Trials: 150. Result: pass.

150 random cases. A derivative-free optimiser (Nelder-Mead, three starting points) minimised ordering + holding + backorder cost over both the order quantity and the maximum backorder level.

| Check | Predicted | Simulated | OK |
|---|---|---|---|
| Cases where the optimiser found a cheaper policy | 0 | 0 | yes |
| Largest relative difference between optimiser cost and formula cost | 0 | 4.13273e-16 | yes |

### Simulated 100,000 order cycles per case: share of cycles with no stockout

Calculators: safety-stock-demand. Trials: 600,000. Result: pass.

Each cycle draws a separate normal demand for every day of the lead time and adds them up. A stockout occurs when lead-time demand exceeds the reorder point.

| Check | Predicted | Simulated | OK |
|---|---|---|---|
| d=100, σ=20, L=4, target 95% | 95 | 94.901 | yes |
| d=15, σ=5, L=2, target 90% | 90 | 90 | yes |
| d=350, σ=90, L=9, target 99% | 99 | 99.009 | yes |
| d=40, σ=12, L=1, target 85% | 85 | 85.077 | yes |
| d=500, σ=60, L=16, target 97.5% | 97.5 | 97.378 | yes |
| d=75, σ=30, L=5, target 92% | 92 | 91.921 | yes |

### Simulated 100,000 order cycles per case with random lead times

Calculators: safety-stock-lead-time. Trials: 400,000. Result: pass.

Demand per day is constant; each cycle draws a normally distributed lead time.

| Check | Predicted | Simulated | OK |
|---|---|---|---|
| d=10, L=6, σLT=3, target 98% | 98 | 98.006 | yes |
| d=50, L=14, σLT=2, target 95% | 95 | 95.047 | yes |
| d=200, L=5, σLT=1.5, target 90% | 90 | 90.098 | yes |
| d=30, L=20, σLT=6, target 99% | 99 | 98.998 | yes |

### Simulated 100,000 order cycles per case with random demand and random lead time

Calculators: safety-stock-combined. Trials: 400,000. Result: pass.

Each cycle draws a lead time, then demand over that lead time. The formula for the standard deviation is exact; treating the total as normal is an approximation, so the service level is allowed 1.5 points of error.

| Check | Predicted | Simulated | OK |
|---|---|---|---|
| d=150, σd=16, L=5, σLT=1, target 95% | 95 | 95.109 | yes |
| standard deviation of lead-time demand | 154.208 | 154.025 | yes |
| d=100, σd=30, L=10, σLT=2, target 90% | 90 | 89.775 | yes |
| standard deviation of lead-time demand | 221.359 | 221.074 | yes |
| d=40, σd=10, L=20, σLT=3, target 97.5% | 97.5 | 97.365 | yes |
| standard deviation of lead-time demand | 128.062 | 127.548 | yes |
| d=2500, σd=500, L=7, σLT=1.5, target 90% | 90 | 89.836 | yes |
| standard deviation of lead-time demand | 3976.49 | 3987.86 | yes |

### Simulated 100,000 cycles per case for a given reorder point

Calculators: cycle-service-level. Trials: 400,000. Result: pass.

Share of simulated cycles in which lead-time demand stayed at or below the reorder point.

| Check | Predicted | Simulated | OK |
|---|---|---|---|
| d=2500, σ=500, L=2, ROP=6000 | 92.135 | 92.258 | yes |
| d=100, σ=20, L=4, ROP=460 | 93.3193 | 93.269 | yes |
| d=800, σ=300, L=3, ROP=2500 | 57.6305 | 57.779 | yes |
| d=60, σ=25, L=6, ROP=330 | 31.2103 | 31.144 | yes |

### Discrete-event simulation of an (s, Q) inventory system

Calculators: fill-rate, continuous-review. Trials: 17,724. Result: pass.

A full inventory system (demand arriving in 24 slices per day, orders of Q placed when stock reaches s, backorders filled on arrival) was run for 60,000 days per case. Cycle service level is the share of cycles ending without a backorder; fill rate is one minus backordered units over total demand. Expected shortage per cycle was also checked against 2,000,000 Monte Carlo draws.

| Check | Predicted | Simulated | OK |
|---|---|---|---|
| d=100, σ=20, L=4: cycle service level (%) | 95 | 95.6019 | yes |
| fill rate (%), (s, Q) calculator | 99.8818 | 99.8966 | yes |
| fill rate (%), fill rate calculator | 99.8818 | 99.8966 | yes |
| d=100, σ=30, L=9: cycle service level (%) | 90 | 89.8567 | yes |
| fill rate (%), (s, Q) calculator | 99.6781 | 99.6849 | yes |
| fill rate (%), fill rate calculator | 99.6781 | 99.6849 | yes |
| d=40, σ=15, L=5: cycle service level (%) | 85 | 83.8573 | yes |
| fill rate (%), (s, Q) calculator | 99.4885 | 99.4283 | yes |
| fill rate (%), fill rate calculator | 99.4885 | 99.4283 | yes |
| expected shortage per cycle, ROP=6000 | 25.1273 | 25.2636 | yes |
| expected shortage per cycle, ROP=460 | 1.17227 | 1.17625 | yes |
| expected shortage per cycle, ROP=950 | 60.3064 | 60.4212 | yes |

### Simulated 400,000 selling seasons: profit at the recommended quantity versus every alternative

Calculators: newsvendor. Trials: 1,600,000. Result: pass.

The same 400,000 simulated demands were used to score the recommended quantity and 241 alternatives spanning three standard deviations either side of the mean.

| Check | Predicted | Simulated | OK |
|---|---|---|---|
| μ=120, σ=15, CR=0.579: expected profit | 60.4268 | 60.4275 | yes |
| best profit on a 241-point grid minus profit at Q* (as a share of profit) | 0 | 1.27225e-07 | yes |
| quantity with the best simulated profit vs Q* (in σ) | 0 | 0.000798675 | yes |
| expected lost sales | 4.60846 | 4.62097 | yes |
| expected leftover | 7.59648 | 7.59567 | yes |
| μ=3192, σ=1181, CR=0.800: expected profit | 222296 | 222430 | yes |
| best profit on a 241-point grid minus profit at Q* (as a share of profit) | 0 | 0 | yes |
| quantity with the best simulated profit vs Q* (in σ) | 0 | 0.00837877 | yes |
| expected lost sales | 131.844 | 132.517 | yes |
| expected leftover | 1125.8 | 1124.46 | yes |
| μ=500, σ=150, CR=0.286: expected profit | 3215.5 | 3217.08 | yes |
| best profit on a 241-point grid minus profit at Q* (as a share of profit) | 0 | 0 | yes |
| quantity with the best simulated profit vs Q* (in σ) | 0 | 0.00905118 | yes |
| expected lost sales | 111.623 | 111.752 | yes |
| expected leftover | 26.7309 | 26.6857 | yes |
| μ=1000, σ=250, CR=0.800: expected profit | 7300.1 | 7296.64 | yes |
| best profit on a 241-point grid minus profit at Q* (as a share of profit) | 0 | 0 | yes |
| quantity with the best simulated profit vs Q* (in σ) | 0 | 0.00837877 | yes |
| expected lost sales | 27.9094 | 27.8243 | yes |
| expected leftover | 238.315 | 238.66 | yes |

### Simulated 100,000 review cycles per case

Calculators: periodic-review. Trials: 300,000. Result: pass.

An order raises the inventory position to the order-up-to level. It must cover demand over one review period plus one lead time, simulated period by period.

| Check | Predicted | Simulated | OK |
|---|---|---|---|
| d=10, σ=3, T=30, L=14, target 98% | 98 | 98.03 | yes |
| d=2500, σ=500, T=4, L=2, target 90% | 90 | 90.133 | yes |
| d=60, σ=25, T=7, L=3, target 95% | 95 | 95.026 | yes |

### Simulated correlated demand at several locations, 200,000 periods per case

Calculators: risk-pooling. Trials: 800,000. Result: pass.

Demand at the locations is drawn from a multivariate normal with the stated correlation. The pooled buffer and each separate buffer are tested for the share of lead times they cover.

| Check | Predicted | Simulated | OK |
|---|---|---|---|
| n=4, ρ=0: pooled service level (%) | 95 | 94.9785 | yes |
| each separate location service level (%) | 95 | 95.0275 | yes |
| n=9, ρ=0.5: pooled service level (%) | 97.5 | 97.4505 | yes |
| each separate location service level (%) | 97.5 | 97.4605 | yes |
| n=16, ρ=0.2: pooled service level (%) | 90 | 89.982 | yes |
| each separate location service level (%) | 90 | 90.0125 | yes |
| n=3, ρ=0.8: pooled service level (%) | 99 | 99.01 | yes |
| each separate location service level (%) | 99 | 98.9965 | yes |

### Brute force and statsmodels: the optimised α is the best on the grid, and fitted values match an independent library

Calculators: exponential-smoothing. Trials: 60. Result: pass.

30 random demand histories. For each, MAD and MSE were recomputed in Python for all 99 values of α. Separately, forecasts with α = 0.3 were compared with statsmodels SimpleExpSmoothing.

| Check | Predicted | Simulated | OK |
|---|---|---|---|
| Histories where a different α had a lower error | 0 | 0 | yes |
| Largest difference from statsmodels fitted values | 0 | 1.13687e-13 | yes |

### Independent libraries: statsmodels Holt and OLS regression

Calculators: holt, linear-regression. Trials: 50. Result: pass.

25 random trending histories. Holt forecasts were compared with statsmodels Holt (known initial level and trend, fixed α and β). Regression coefficients, r² and standard error were compared with statsmodels OLS.

| Check | Predicted | Simulated | OK |
|---|---|---|---|
| Largest difference from statsmodels Holt forecasts | 0 | 0 | yes |
| Largest difference from statsmodels OLS (a, b, r², Syx) | 0 | 1.13687e-13 | yes |

### Simulated 3,000,000 customers per case through a single-server queue

Calculators: mm1, littles-law. Trials: 9,000,000. Result: pass.

Exponential interarrival and service times. Waiting times come from the Lindley recursion. The number in the system is measured independently by sampling random instants, which is what makes the Little's Law comparison a real test.

| Check | Predicted | Simulated | OK |
|---|---|---|---|
| λ=2.0, μ=3.0: average wait in line Wq | 0.666667 | 0.671117 | yes |
| average number in system Ls (sampled at 300,000 random instants) | 2 | 2.0084 | yes |
| Little's Law: sampled number in system vs arrival rate × time in system | 2.00862 | 2.0084 | yes |
| probability the server is idle P0 | 0.333333 | 0.333529 | yes |
| λ=10.0, μ=12.0: average wait in line Wq | 0.416667 | 0.412282 | yes |
| average number in system Ls (sampled at 300,000 random instants) | 5 | 4.96318 | yes |
| Little's Law: sampled number in system vs arrival rate × time in system | 4.95633 | 4.96318 | yes |
| probability the server is idle P0 | 0.166667 | 0.16655 | yes |
| λ=5.0, μ=10.0: average wait in line Wq | 0.1 | 0.0995732 | yes |
| average number in system Ls (sampled at 300,000 random instants) | 1 | 0.993753 | yes |
| Little's Law: sampled number in system vs arrival rate × time in system | 0.997349 | 0.993753 | yes |
| probability the server is idle P0 | 0.5 | 0.500425 | yes |

### Feasibility audit and exhaustive search for the true minimum number of stations

Calculators: line-balancing. Trials: 300. Result: pass.

300 random lines with 4 to 9 tasks. Every assignment was checked for precedence and cycle-time violations, and the true minimum number of stations was found by dynamic programming over all task subsets.

| Check | Predicted | Simulated | OK |
|---|---|---|---|
| assignments that break precedence or exceed the cycle time | 0 | 0 | yes |
| lines where the answer used fewer stations than the true minimum (impossible) | 0 | 0 | yes |
| share of lines where the heuristic found the true minimum (%) | 100 | 95 | yes |
| largest excess over the true minimum (stations) | 0 | 1 | yes |

### Simulated the multi-server queue as a Markov chain, 1,500,000 events per case

Calculators: mms, queue-probabilities. Trials: 6,000,000. Result: pass.

The number in the system was simulated as a continuous-time Markov chain (arrivals at rate λ, departures at rate min(n, s)·μ). State probabilities are the share of simulated time spent in each state.

| Check | Predicted | Simulated | OK |
|---|---|---|---|
| λ=2.0, μ=3.0, s=2: average number in line Lq | 0.0833333 | 0.0831014 | yes |
| average wait in line Wq (= Lq / λ) | 0.0416667 | 0.0415507 | yes |
| probability a customer waits (all servers busy) | 0.166667 | 0.167032 | yes |
| probability the system is empty P0 | 0.5 | 0.500375 | yes |
| probability of exactly 2 in system | 0.111111 | 0.111436 | yes |
| probability of more than 2 in system | 0.0555556 | 0.0555959 | yes |
| λ=40.0, μ=15.0, s=3: average number in line Lq | 6.38006 | 6.51607 | yes |
| average wait in line Wq (= Lq / λ) | 0.159502 | 0.162902 | yes |
| probability a customer waits (all servers busy) | 0.797508 | 0.799473 | yes |
| probability the system is empty P0 | 0.0280374 | 0.0278105 | yes |
| probability of exactly 5 in system | 0.0700144 | 0.0695817 | yes |
| probability of more than 5 in system | 0.560115 | 0.564002 | yes |
| λ=18.0, μ=4.0, s=6: average number in line Lq | 1.26496 | 1.2459 | yes |
| average wait in line Wq (= Lq / λ) | 0.0702753 | 0.0692168 | yes |
| probability a customer waits (all servers busy) | 0.421652 | 0.418724 | yes |
| probability the system is empty P0 | 0.00914012 | 0.00933907 | yes |
| probability of exactly 7 in system | 0.0790598 | 0.07871 | yes |
| probability of more than 7 in system | 0.237179 | 0.234651 | yes |
| λ=2.0, μ=3.0, s=1: average number in line Lq | 1.33333 | 1.34391 | yes |
| average wait in line Wq (= Lq / λ) | 0.666667 | 0.671957 | yes |
| probability a customer waits (all servers busy) | 0.666667 | 0.667288 | yes |
| probability the system is empty P0 | 0.333333 | 0.332712 | yes |
| probability of exactly 3 in system | 0.0987654 | 0.0984858 | yes |
| probability of more than 3 in system | 0.197531 | 0.19907 | yes |
| M/M/1 λ=2, μ=3: probability the wait exceeds 0.5 | 0.404354 | 0.405394 | yes |

### Simulated 3,000,000 customers per case with constant service time

Calculators: md1. Trials: 9,000,000. Result: pass.

Exponential interarrival times, identical service time for every customer.

| Check | Predicted | Simulated | OK |
|---|---|---|---|
| λ=8.0, μ=12.0: average wait in line Wq | 0.0833333 | 0.0834574 | yes |
| average number in line Lq | 0.666667 | 0.667592 | yes |
| λ=10.0, μ=15.0: average wait in line Wq | 0.0666667 | 0.0669363 | yes |
| average number in line Lq | 0.666667 | 0.669777 | yes |
| λ=9.0, μ=10.0: average wait in line Wq | 0.45 | 0.456151 | yes |
| average number in line Lq | 4.05 | 4.10828 | yes |

### Simulated general queues (gamma-distributed times) against Kingman's approximation

Calculators: kingman. Trials: 8,800,000. Result: pass.

Interarrival and service times follow gamma distributions with the stated coefficients of variation. With both CVs equal to 1 and one server the formula is exact (3% tolerance). Otherwise it is an approximation, most accurate at high utilisation: results must be within 20% and the actual gap is shown.

| Check | Predicted | Simulated | OK |
|---|---|---|---|
| a=5, p=4, m=1, CVa=1, CVp=1 (u=0.80): wait in line | 16 | 15.9915 | yes |
| a=10, p=9, m=1, CVa=0.5, CVp=0.5 (u=0.90): wait in line | 20.25 | 18.7512 | yes |
| a=10, p=8.5, m=1, CVa=1.5, CVp=0.5 (u=0.85): wait in line | 60.2083 | 62.9331 | yes |
| a=10, p=8, m=1, CVa=0.75, CVp=1.25 (u=0.80): wait in line | 34 | 32.578 | yes |
| a=35, p=120, m=4, CVa=1, CVp=1 (u=0.86): wait in line | 150.474 | 145.407 | yes |
| a=4, p=10, m=3, CVa=1.2, CVp=0.8 (u=0.83): wait in line | 14.9034 | 15.4958 | yes |

### Control chart factors rebuilt from first principles, and false-alarm rate of an in-control process

Calculators: xbar-r-chart. Trials: 73,200,000. Result: pass.

d2 comes from numerical integration of the range distribution and d3 from 3,000,000 simulated samples per subgroup size; A2, D3 and D4 follow from them and must match the built-in table to rounding. Then limits were computed from 2,000 in-control samples and applied to 400,000 fresh ones: about 0.27% should fall outside.

| Check | Predicted | Simulated | OK |
|---|---|---|---|
| largest gap, A2 table vs 3/(d2·√n) | 0 | 0.000472624 | yes |
| largest gap, d2 table vs numerical integration | 0 | 0.000494538 | yes |
| largest gap, D3 table vs simulated | 0 | 0.000883707 | yes |
| largest gap, D4 table vs simulated | 0 | 0.00171732 | yes |
| rows where the engine table differs from the independently typed table | 0 | 0 | yes |
| n=4: share of in-control sample means outside the limits (%) | 0.27 | 0.244 | yes |
| n=5: share of in-control sample means outside the limits (%) | 0.27 | 0.2085 | yes |
| n=8: share of in-control sample means outside the limits (%) | 0.27 | 0.28125 | yes |

### Simulated stable attribute processes against exact binomial and Poisson tail probabilities

Calculators: p-chart, c-chart. Trials: 6,000,000. Result: pass.

Limits were computed by the engine from the first 400 samples, then 1,000,000 simulated samples were classified. The share outside is compared with the exact binomial or Poisson probability for those limits.

| Check | Predicted | Simulated | OK |
|---|---|---|---|
| p-chart n=100, p=0.04: share of samples outside the limits (%) | 0.223855 | 0.2219 | yes |
| centre line vs true defect rate | 0.04 | 0.041925 | yes |
| p-chart n=50, p=0.05: share of samples outside the limits (%) | 0.318834 | 0.3143 | yes |
| centre line vs true defect rate | 0.05 | 0.05105 | yes |
| p-chart n=200, p=0.1: share of samples outside the limits (%) | 0.340094 | 0.3436 | yes |
| centre line vs true defect rate | 0.1 | 0.100675 | yes |
| c-chart mean 6: share of periods outside the limits (%) | 0.362849 | 0.3569 | yes |
| c-chart mean 13: share of periods outside the limits (%) | 0.400341 | 0.3966 | yes |
| c-chart mean 25: share of periods outside the limits (%) | 0.262206 | 0.2572 | yes |

### Simulated 5,000,000 units of normal output per case

Calculators: process-capability, taguchi-loss. Trials: 25,000,000. Result: pass.

Normal output was generated and compared unit by unit with the specification limits (capability) or scored with the quadratic loss (Taguchi).

| Check | Predicted | Simulated | OK |
|---|---|---|---|
| Cpk=0.67: defects per million | 22751.7 | 22645 | yes |
| Cpk=1.00: defects per million | 2699.8 | 2719.2 | yes |
| Cpk=0.61: defects per million | 34656.4 | 34660.4 | yes |
| Taguchi expected loss per unit, μ=10.1, σ=0.2 | 4 | 3.99999 | yes |
| Taguchi expected loss per unit, μ=50.6, σ=1.3 | 23.0625 | 23.0619 | yes |

### Inventory balance audit and comparison with the optimal (Wagner-Whitin) plan

Calculators: lot-for-lot, fixed-order-quantity, poq-lot-sizing, part-period-balancing, mrp-gross-to-net. Trials: 1,000. Result: pass.

200 random requirement schedules. Each plan was replayed period by period to recompute inventory and cost, and compared with the minimum-cost plan from Wagner-Whitin dynamic programming. The lot-sizing rules are heuristics, so their average gap to the optimum is reported for information.

| Check | Predicted | Simulated | OK |
|---|---|---|---|
| periods where inventory went negative, or recomputed balance or cost differed | 0 | 0 | yes |
| plans cheaper than the proven optimum (impossible) | 0 | 0 | yes |
| MRP records that dipped below safety stock after an order, or lost units between receipt and release | 0 | 0 | yes |
| lot-for-lot: average cost above the optimal plan (%) | 0 | 45.0023 | yes |
| fixed-order-quantity: average cost above the optimal plan (%) | 0 | 73.2801 | yes |
| poq-lot-sizing: average cost above the optimal plan (%) | 0 | 9.94205 | yes |
| part-period-balancing: average cost above the optimal plan (%) | 0 | 11.008 | yes |

### Period-by-period replay of each production plan

Calculators: aggregate-planning. Trials: 200. Result: pass.

200 random demand plans. Each strategy was rebuilt independently with array arithmetic: level output with cumulative inventory, chase output with rate changes, and a base workforce at minimum demand with the remainder subcontracted. Every plan must meet total demand exactly.

| Check | Predicted | Simulated | OK |
|---|---|---|---|
| plans whose cost or ending inventory differed from the replay | 0 | 0 | yes |

### Numerical minimisation of volume-weighted squared distance

Calculators: center-of-gravity. Trials: 200. Result: pass.

200 random sets of 2 to 9 locations. A derivative-free optimiser searched for the point with the lowest volume-weighted sum of squared distances.

| Check | Predicted | Simulated | OK |
|---|---|---|---|
| largest distance between the optimiser’s point and the center of gravity | 0 | 1.37693e-06 | yes |

### Exhaustive path enumeration on 300 random project networks

Calculators: cpm. Trials: 300. Result: pass.

Every start-to-finish path was enumerated by depth-first search and the longest was compared with the reported project duration.

| Check | Predicted | Simulated | OK |
|---|---|---|---|
| networks where the longest path differed from the project duration | 0 | 0 | yes |

### Monte Carlo simulation of project completion time, 500,000 runs per case

Calculators: pert, pert-probability. Trials: 1,000,000. Result: pass.

Activity times were drawn with the PERT means and variances and pushed through the network. For a single path the normal approximation is exact (0.5-point tolerance). With parallel paths the textbook method looks only at the critical path, so it is slightly optimistic: the gap is shown and must stay within 8 points.

| Check | Predicted | Simulated | OK |
|---|---|---|---|
| four activities in series: expected duration | 19 | 18.9989 | yes |
| project variance | 6.33333 | 6.34253 | yes |
| expected duration with beta-distributed activity times | 19 | 18.9995 | yes |
| four activities in series: chance of finishing by 20.5 (%) | 72.5747 | 72.6218 | yes |
| four activities in series: chance of finishing by 22.8 (%) | 93.3193 | 93.3046 | yes |
| eight-activity network with parallel paths: chance of finishing by 16.0 (%) | 71.4625 | 69.3524 | yes |
| eight-activity network with parallel paths: chance of finishing by 18.0 (%) | 95.5513 | 95.3716 | yes |

### Exhaustive enumeration of every crash plan on 80 small projects

Calculators: crashing. Trials: 80. Result: pass.

80 random projects with 3 to 6 activities and whole-period crash limits. Every combination of crash amounts was tried, and the cheapest one that meets the target was compared with the linear-programming answer.

| Check | Predicted | Simulated | OK |
|---|---|---|---|
| projects where enumeration found a different minimum cost | 0 | 0 | yes |

### Simulated 1,000,000 repetitions of each decision

Calculators: expected-value, evpi. Trials: 3,000,000. Result: pass.

The state of nature was drawn 1,000,000 times. Each alternative was scored by its average payoff; perfect information was scored by always taking the best payoff for the state that occurred.

| Check | Predicted | Simulated | OK |
|---|---|---|---|
| 2 states: average payoff of the recommended alternative (share of largest payoff) | 0.2 | 0.200256 | yes |
| alternative with the best simulated average | 2 | 2 | yes |
| value of perfect information (share of largest payoff) | 0.3 | 0.30017 | yes |
| 3 states: average payoff of the recommended alternative (share of largest payoff) | 0.48 | 0.479898 | yes |
| alternative with the best simulated average | 2 | 2 | yes |
| value of perfect information (share of largest payoff) | 0.11 | 0.109983 | yes |
| 4 states: average payoff of the recommended alternative (share of largest payoff) | 0.386111 | 0.385924 | yes |
| alternative with the best simulated average | 2 | 2 | yes |
| value of perfect information (share of largest payoff) | 0.0833333 | 0.0834458 | yes |

### Simulated 1,000,000 passes through a two-stage decision tree

Calculators: decision-tree. Trials: 1,000,000. Result: pass.

The recommended strategy (test first, build only after a positive result) was played 1,000,000 times, along with the two alternatives it beat.

| Check | Predicted | Simulated | OK |
|---|---|---|---|
| average payoff of the recommended strategy | 45.4 | 45.3784 | yes |
| "build now" earns less | 44 | 44.0694 | yes |
| "test, then build regardless" earns less | 41.8 | 41.8035 | yes |
| recommended first move is the best simulated one | 2 | 2 | yes |


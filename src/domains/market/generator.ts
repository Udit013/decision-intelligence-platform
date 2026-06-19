/**
 * SYNTHETIC market generator — DEMO DATA, ported from geostrategy.
 *
 * ⚠️ Everything here is modeled, not real: country economic figures are editorial
 * estimates and all scores are computed from modeled weights. The UI labels this
 * domain "DEMO DATA / MODELED" at the top level.
 *
 * Provenance fix vs the old repo: the source array listed Pakistan TWICE (codes
 * PK and PK2) and deduped only by code, so both survived and it advertised "121
 * markets". The duplicate is removed here; `generateMarkets()` additionally dedupes
 * by name+code, and the real distinct count is reported by MARKET_COUNT.
 */
import type { Market, CompetitiveData, Opportunity } from './types'

const RAW_COUNTRIES = [
  { name: 'United States', code: 'US', continent: 'North America', gdp: 27360, gdpGrowth: 2.5, pop: 335, internet: 92, mobile: 88, urban: 83, income: 65000, ppi: 100, ease: 84, tax: 21, inflation: 3.2, currency: 95 },
  { name: 'China', code: 'CN', continent: 'Asia', gdp: 17794, gdpGrowth: 5.2, pop: 1412, internet: 77, mobile: 82, urban: 65, income: 12720, ppi: 72, ease: 78, tax: 25, inflation: 0.7, currency: 82 },
  { name: 'Germany', code: 'DE', continent: 'Europe', gdp: 4456, gdpGrowth: 1.1, pop: 84, internet: 91, mobile: 83, urban: 77, income: 52000, ppi: 88, ease: 79, tax: 30, inflation: 2.9, currency: 90 },
  { name: 'Japan', code: 'JP', continent: 'Asia', gdp: 4231, gdpGrowth: 0.8, pop: 125, internet: 93, mobile: 87, urban: 92, income: 42000, ppi: 83, ease: 78, tax: 29.74, inflation: 2.8, currency: 88 },
  { name: 'United Kingdom', code: 'GB', continent: 'Europe', gdp: 3159, gdpGrowth: 1.4, pop: 67, internet: 95, mobile: 91, urban: 84, income: 46000, ppi: 87, ease: 82, tax: 25, inflation: 4.0, currency: 89 },
  { name: 'France', code: 'FR', continent: 'Europe', gdp: 3011, gdpGrowth: 1.1, pop: 68, internet: 92, mobile: 83, urban: 81, income: 44000, ppi: 85, ease: 76, tax: 26.5, inflation: 3.7, currency: 90 },
  { name: 'Canada', code: 'CA', continent: 'North America', gdp: 2140, gdpGrowth: 1.9, pop: 38, internet: 93, mobile: 88, urban: 82, income: 56000, ppi: 89, ease: 82, tax: 26.5, inflation: 3.4, currency: 87 },
  { name: 'Italy', code: 'IT', continent: 'Europe', gdp: 2170, gdpGrowth: 0.7, pop: 60, internet: 85, mobile: 79, urban: 71, income: 35000, ppi: 76, ease: 72, tax: 27.9, inflation: 5.9, currency: 90 },
  { name: 'South Korea', code: 'KR', continent: 'Asia', gdp: 1710, gdpGrowth: 2.2, pop: 52, internet: 97, mobile: 95, urban: 81, income: 33000, ppi: 78, ease: 84, tax: 25, inflation: 3.6, currency: 82 },
  { name: 'Australia', code: 'AU', continent: 'Oceania', gdp: 1693, gdpGrowth: 2.0, pop: 26, internet: 91, mobile: 87, urban: 87, income: 65000, ppi: 87, ease: 81, tax: 30, inflation: 3.8, currency: 85 },
  { name: 'India', code: 'IN', continent: 'Asia', gdp: 3738, gdpGrowth: 7.8, pop: 1440, internet: 52, mobile: 79, urban: 36, income: 2600, ppi: 45, ease: 63, tax: 25.2, inflation: 5.7, currency: 65 },
  { name: 'Brazil', code: 'BR', continent: 'South America', gdp: 2174, gdpGrowth: 3.1, pop: 215, internet: 84, mobile: 88, urban: 87, income: 10100, ppi: 55, ease: 56, tax: 34, inflation: 4.6, currency: 60 },
  { name: 'Mexico', code: 'MX', continent: 'North America', gdp: 1322, gdpGrowth: 3.2, pop: 128, internet: 76, mobile: 82, urban: 81, income: 10300, ppi: 58, ease: 60, tax: 30, inflation: 4.7, currency: 68 },
  { name: 'Russia', code: 'RU', continent: 'Europe', gdp: 1862, gdpGrowth: 2.8, pop: 145, internet: 88, mobile: 85, urban: 75, income: 12800, ppi: 62, ease: 58, tax: 20, inflation: 7.4, currency: 40 },
  { name: 'Indonesia', code: 'ID', continent: 'Asia', gdp: 1319, gdpGrowth: 5.3, pop: 275, internet: 77, mobile: 75, urban: 57, income: 4800, ppi: 50, ease: 69, tax: 22, inflation: 3.7, currency: 70 },
  { name: 'Turkey', code: 'TR', continent: 'Europe', gdp: 1108, gdpGrowth: 5.5, pop: 85, internet: 82, mobile: 88, urban: 77, income: 13000, ppi: 52, ease: 64, tax: 22, inflation: 64.3, currency: 20 },
  { name: 'Saudi Arabia', code: 'SA', continent: 'Asia', gdp: 1069, gdpGrowth: 3.9, pop: 35, internet: 97, mobile: 94, urban: 85, income: 30500, ppi: 74, ease: 71, tax: 20, inflation: 2.2, currency: 92 },
  { name: 'Argentina', code: 'AR', continent: 'South America', gdp: 632, gdpGrowth: -2.5, pop: 46, internet: 88, mobile: 89, urban: 93, income: 13700, ppi: 30, ease: 46, tax: 35, inflation: 143, currency: 8 },
  { name: 'Thailand', code: 'TH', continent: 'Asia', gdp: 512, gdpGrowth: 3.8, pop: 71, internet: 88, mobile: 90, urban: 53, income: 7200, ppi: 55, ease: 76, tax: 20, inflation: 1.2, currency: 74 },
  { name: 'Vietnam', code: 'VN', continent: 'Asia', gdp: 430, gdpGrowth: 6.9, pop: 97, internet: 79, mobile: 80, urban: 38, income: 4400, ppi: 42, ease: 70, tax: 20, inflation: 3.4, currency: 72 },
  { name: 'Nigeria', code: 'NG', continent: 'Africa', gdp: 477, gdpGrowth: 2.9, pop: 220, internet: 55, mobile: 88, urban: 53, income: 2200, ppi: 35, ease: 52, tax: 30, inflation: 27.3, currency: 30 },
  { name: 'Egypt', code: 'EG', continent: 'Africa', gdp: 387, gdpGrowth: 4.2, pop: 105, internet: 72, mobile: 87, urban: 43, income: 3700, ppi: 38, ease: 60, tax: 22.5, inflation: 38, currency: 38 },
  { name: 'Kenya', code: 'KE', continent: 'Africa', gdp: 113, gdpGrowth: 5.6, pop: 55, internet: 41, mobile: 89, urban: 29, income: 2000, ppi: 30, ease: 61, tax: 30, inflation: 7.7, currency: 55 },
  { name: 'Ethiopia', code: 'ET', continent: 'Africa', gdp: 156, gdpGrowth: 7.2, pop: 126, internet: 24, mobile: 42, urban: 23, income: 1200, ppi: 20, ease: 54, tax: 30, inflation: 28, currency: 40 },
  { name: 'Ghana', code: 'GH', continent: 'Africa', gdp: 75, gdpGrowth: 2.8, pop: 33, internet: 68, mobile: 89, urban: 58, income: 2300, ppi: 33, ease: 60, tax: 25, inflation: 40, currency: 35 },
  { name: 'South Africa', code: 'ZA', continent: 'Africa', gdp: 399, gdpGrowth: 0.6, pop: 60, internet: 72, mobile: 91, urban: 68, income: 6600, ppi: 48, ease: 67, tax: 28, inflation: 5.9, currency: 52 },
  { name: 'Morocco', code: 'MA', continent: 'Africa', gdp: 141, gdpGrowth: 3.7, pop: 37, internet: 88, mobile: 79, urban: 65, income: 3800, ppi: 40, ease: 63, tax: 31, inflation: 6.2, currency: 65 },
  { name: 'Pakistan', code: 'PK', continent: 'Asia', gdp: 338, gdpGrowth: 2.4, pop: 230, internet: 48, mobile: 78, urban: 37, income: 1470, ppi: 28, ease: 53, tax: 29, inflation: 29.2, currency: 25 },
  { name: 'Bangladesh', code: 'BD', continent: 'Asia', gdp: 446, gdpGrowth: 6.3, pop: 170, internet: 44, mobile: 78, urban: 39, income: 2700, ppi: 32, ease: 55, tax: 25, inflation: 9.4, currency: 58 },
  { name: 'Philippines', code: 'PH', continent: 'Asia', gdp: 435, gdpGrowth: 5.9, pop: 113, internet: 73, mobile: 82, urban: 47, income: 3850, ppi: 44, ease: 65, tax: 25, inflation: 5.8, currency: 62 },
  { name: 'Netherlands', code: 'NL', continent: 'Europe', gdp: 1009, gdpGrowth: 1.5, pop: 17, internet: 96, mobile: 85, urban: 93, income: 58000, ppi: 86, ease: 83, tax: 25.8, inflation: 4.1, currency: 90 },
  { name: 'Spain', code: 'ES', continent: 'Europe', gdp: 1582, gdpGrowth: 2.5, pop: 48, internet: 91, mobile: 82, urban: 81, income: 33000, ppi: 77, ease: 74, tax: 25, inflation: 3.5, currency: 90 },
  { name: 'Switzerland', code: 'CH', continent: 'Europe', gdp: 869, gdpGrowth: 1.4, pop: 8.7, internet: 97, mobile: 89, urban: 74, income: 90000, ppi: 92, ease: 86, tax: 14.9, inflation: 2.1, currency: 96 },
  { name: 'Sweden', code: 'SE', continent: 'Europe', gdp: 593, gdpGrowth: 0.5, pop: 10, internet: 97, mobile: 90, urban: 88, income: 58000, ppi: 88, ease: 82, tax: 20.6, inflation: 8.5, currency: 87 },
  { name: 'Poland', code: 'PL', continent: 'Europe', gdp: 811, gdpGrowth: 0.5, pop: 38, internet: 93, mobile: 86, urban: 60, income: 20000, ppi: 72, ease: 75, tax: 19, inflation: 11.4, currency: 78 },
  { name: 'Israel', code: 'IL', continent: 'Asia', gdp: 527, gdpGrowth: 1.3, pop: 9.7, internet: 91, mobile: 85, urban: 93, income: 46000, ppi: 86, ease: 76, tax: 23, inflation: 4.8, currency: 80 },
  { name: 'UAE', code: 'AE', continent: 'Asia', gdp: 509, gdpGrowth: 4.1, pop: 9.9, internet: 99, mobile: 97, urban: 88, income: 51000, ppi: 85, ease: 88, tax: 9, inflation: 3.3, currency: 95 },
  { name: 'Singapore', code: 'SG', continent: 'Asia', gdp: 501, gdpGrowth: 1.6, pop: 5.9, internet: 97, mobile: 93, urban: 100, income: 87000, ppi: 90, ease: 91, tax: 17, inflation: 4.8, currency: 94 },
  { name: 'Malaysia', code: 'MY', continent: 'Asia', gdp: 430, gdpGrowth: 4.5, pop: 33, internet: 96, mobile: 93, urban: 78, income: 13000, ppi: 62, ease: 81, tax: 24, inflation: 2.5, currency: 76 },
  { name: 'Chile', code: 'CL', continent: 'South America', gdp: 344, gdpGrowth: 2.4, pop: 19, internet: 90, mobile: 90, urban: 88, income: 17900, ppi: 65, ease: 72, tax: 27, inflation: 7.6, currency: 68 },
  { name: 'Colombia', code: 'CO', continent: 'South America', gdp: 363, gdpGrowth: 1.2, pop: 51, internet: 78, mobile: 83, urban: 81, income: 7100, ppi: 50, ease: 67, tax: 35, inflation: 13.2, currency: 58 },
  { name: 'Peru', code: 'PE', continent: 'South America', gdp: 267, gdpGrowth: 1.1, pop: 33, internet: 77, mobile: 87, urban: 79, income: 8100, ppi: 52, ease: 65, tax: 30, inflation: 3.2, currency: 62 },
  { name: 'Ukraine', code: 'UA', continent: 'Europe', gdp: 148, gdpGrowth: 5.5, pop: 43, internet: 82, mobile: 87, urban: 70, income: 4500, ppi: 40, ease: 58, tax: 18, inflation: 11.4, currency: 28 },
  { name: 'Romania', code: 'RO', continent: 'Europe', gdp: 350, gdpGrowth: 2.5, pop: 19, internet: 88, mobile: 82, urban: 54, income: 18000, ppi: 68, ease: 71, tax: 16, inflation: 7.4, currency: 78 },
  { name: 'Czech Republic', code: 'CZ', continent: 'Europe', gdp: 330, gdpGrowth: 0.5, pop: 11, internet: 93, mobile: 85, urban: 74, income: 29000, ppi: 76, ease: 76, tax: 19, inflation: 10.7, currency: 82 },
  { name: 'Greece', code: 'GR', continent: 'Europe', gdp: 239, gdpGrowth: 2.2, pop: 11, internet: 85, mobile: 78, urban: 80, income: 22000, ppi: 70, ease: 69, tax: 24, inflation: 3.5, currency: 90 },
  { name: 'Portugal', code: 'PT', continent: 'Europe', gdp: 284, gdpGrowth: 2.3, pop: 10, internet: 90, mobile: 83, urban: 67, income: 27000, ppi: 74, ease: 75, tax: 21, inflation: 3.8, currency: 90 },
  { name: 'Hungary', code: 'HU', continent: 'Europe', gdp: 212, gdpGrowth: 0.3, pop: 10, internet: 90, mobile: 80, urban: 72, income: 21000, ppi: 70, ease: 73, tax: 9, inflation: 17.6, currency: 72 },
  { name: 'Kazakhstan', code: 'KZ', continent: 'Asia', gdp: 261, gdpGrowth: 5.1, pop: 19, internet: 90, mobile: 89, urban: 58, income: 13600, ppi: 55, ease: 68, tax: 20, inflation: 14.7, currency: 60 },
  { name: 'New Zealand', code: 'NZ', continent: 'Oceania', gdp: 247, gdpGrowth: 1.0, pop: 5.1, internet: 92, mobile: 87, urban: 87, income: 48000, ppi: 84, ease: 86, tax: 28, inflation: 5.4, currency: 82 },
  { name: 'Austria', code: 'AT', continent: 'Europe', gdp: 530, gdpGrowth: 0.8, pop: 9.1, internet: 93, mobile: 86, urban: 59, income: 54000, ppi: 87, ease: 78, tax: 25, inflation: 7.9, currency: 90 },
  { name: 'Belgium', code: 'BE', continent: 'Europe', gdp: 620, gdpGrowth: 1.4, pop: 11.6, internet: 94, mobile: 84, urban: 98, income: 51000, ppi: 85, ease: 75, tax: 25, inflation: 2.6, currency: 90 },
  { name: 'Denmark', code: 'DK', continent: 'Europe', gdp: 406, gdpGrowth: 1.8, pop: 5.9, internet: 97, mobile: 90, urban: 88, income: 64000, ppi: 91, ease: 85, tax: 22, inflation: 3.3, currency: 89 },
  { name: 'Finland', code: 'FI', continent: 'Europe', gdp: 302, gdpGrowth: -0.7, pop: 5.5, internet: 97, mobile: 87, urban: 73, income: 55000, ppi: 87, ease: 80, tax: 20, inflation: 4.2, currency: 90 },
  { name: 'Norway', code: 'NO', continent: 'Europe', gdp: 546, gdpGrowth: 1.1, pop: 5.5, internet: 99, mobile: 92, urban: 84, income: 82000, ppi: 93, ease: 82, tax: 22, inflation: 5.5, currency: 90 },
  { name: 'Hong Kong', code: 'HK', continent: 'Asia', gdp: 360, gdpGrowth: 3.2, pop: 7.5, internet: 95, mobile: 96, urban: 100, income: 48000, ppi: 85, ease: 85, tax: 16.5, inflation: 2.1, currency: 90 },
  { name: 'Taiwan', code: 'TW', continent: 'Asia', gdp: 751, gdpGrowth: 1.3, pop: 23, internet: 97, mobile: 95, urban: 80, income: 32000, ppi: 79, ease: 80, tax: 20, inflation: 2.5, currency: 85 },
  { name: 'Iraq', code: 'IQ', continent: 'Asia', gdp: 250, gdpGrowth: 4.1, pop: 42, internet: 74, mobile: 82, urban: 71, income: 6000, ppi: 40, ease: 38, tax: 15, inflation: 4.1, currency: 50 },
  { name: 'Qatar', code: 'QA', continent: 'Asia', gdp: 235, gdpGrowth: 2.4, pop: 2.9, internet: 100, mobile: 100, urban: 100, income: 82000, ppi: 88, ease: 77, tax: 10, inflation: 2.7, currency: 93 },
  { name: 'Kuwait', code: 'KW', continent: 'Asia', gdp: 163, gdpGrowth: 1.2, pop: 4.4, internet: 99, mobile: 91, urban: 100, income: 36000, ppi: 78, ease: 72, tax: 15, inflation: 3.6, currency: 93 },
  { name: 'Algeria', code: 'DZ', continent: 'Africa', gdp: 239, gdpGrowth: 4.4, pop: 45, internet: 71, mobile: 82, urban: 74, income: 5300, ppi: 42, ease: 48, tax: 26, inflation: 9.3, currency: 52 },
  { name: 'Tanzania', code: 'TZ', continent: 'Africa', gdp: 79, gdpGrowth: 5.2, pop: 64, internet: 29, mobile: 48, urban: 37, income: 1200, ppi: 22, ease: 54, tax: 30, inflation: 3.8, currency: 50 },
  { name: 'Angola', code: 'AO', continent: 'Africa', gdp: 93, gdpGrowth: 1.3, pop: 34, internet: 38, mobile: 40, urban: 68, income: 2700, ppi: 30, ease: 41, tax: 30, inflation: 13.6, currency: 35 },
  { name: 'Ivory Coast', code: 'CI', continent: 'Africa', gdp: 69, gdpGrowth: 6.4, pop: 27, internet: 47, mobile: 90, urban: 52, income: 2600, ppi: 28, ease: 59, tax: 25, inflation: 3.0, currency: 60 },
  { name: 'Uganda', code: 'UG', continent: 'Africa', gdp: 46, gdpGrowth: 5.6, pop: 48, internet: 32, mobile: 60, urban: 26, income: 960, ppi: 18, ease: 57, tax: 30, inflation: 5.4, currency: 48 },
  { name: 'Senegal', code: 'SN', continent: 'Africa', gdp: 28, gdpGrowth: 4.8, pop: 18, internet: 66, mobile: 83, urban: 49, income: 1600, ppi: 24, ease: 59, tax: 25, inflation: 5.9, currency: 58 },
  { name: 'Sri Lanka', code: 'LK', continent: 'Asia', gdp: 74, gdpGrowth: 2.2, pop: 22, internet: 52, mobile: 79, urban: 19, income: 3360, ppi: 35, ease: 63, tax: 30, inflation: 12.1, currency: 42 },
  { name: 'Myanmar', code: 'MM', continent: 'Asia', gdp: 64, gdpGrowth: 1.0, pop: 54, internet: 52, mobile: 72, urban: 32, income: 1200, ppi: 28, ease: 45, tax: 25, inflation: 26.3, currency: 30 },
  { name: 'Cambodia', code: 'KH', continent: 'Asia', gdp: 30, gdpGrowth: 5.8, pop: 17, internet: 62, mobile: 85, urban: 25, income: 1700, ppi: 30, ease: 68, tax: 20, inflation: 2.0, currency: 68 },
  { name: 'Nepal', code: 'NP', continent: 'Asia', gdp: 41, gdpGrowth: 4.7, pop: 30, internet: 49, mobile: 74, urban: 21, income: 1360, ppi: 24, ease: 55, tax: 25, inflation: 7.3, currency: 55 },
  { name: 'Azerbaijan', code: 'AZ', continent: 'Asia', gdp: 78, gdpGrowth: 2.5, pop: 10, internet: 88, mobile: 91, urban: 56, income: 7800, ppi: 52, ease: 65, tax: 20, inflation: 9.4, currency: 62 },
  { name: 'Uzbekistan', code: 'UZ', continent: 'Asia', gdp: 90, gdpGrowth: 6.3, pop: 35, internet: 75, mobile: 79, urban: 51, income: 2600, ppi: 35, ease: 62, tax: 15, inflation: 10.5, currency: 55 },
  { name: 'Bolivia', code: 'BO', continent: 'South America', gdp: 45, gdpGrowth: 1.8, pop: 12, internet: 64, mobile: 82, urban: 71, income: 3700, ppi: 38, ease: 51, tax: 25, inflation: 2.6, currency: 60 },
  { name: 'Ecuador', code: 'EC', continent: 'South America', gdp: 118, gdpGrowth: 2.7, pop: 18, internet: 75, mobile: 85, urban: 64, income: 6600, ppi: 46, ease: 55, tax: 25, inflation: 2.2, currency: 80 },
  { name: 'Guatemala', code: 'GT', continent: 'North America', gdp: 96, gdpGrowth: 4.2, pop: 17, internet: 70, mobile: 70, urban: 53, income: 5600, ppi: 42, ease: 56, tax: 25, inflation: 6.2, currency: 68 },
  { name: 'Dominican Republic', code: 'DO', continent: 'North America', gdp: 118, gdpGrowth: 4.8, pop: 11, internet: 82, mobile: 79, urban: 83, income: 10700, ppi: 52, ease: 60, tax: 27, inflation: 4.9, currency: 65 },
  { name: 'Costa Rica', code: 'CR', continent: 'North America', gdp: 65, gdpGrowth: 4.2, pop: 5.2, internet: 90, mobile: 89, urban: 82, income: 12400, ppi: 60, ease: 68, tax: 30, inflation: 3.3, currency: 72 },
  { name: 'Panama', code: 'PA', continent: 'North America', gdp: 76, gdpGrowth: 6.0, pop: 4.4, internet: 72, mobile: 88, urban: 68, income: 17300, ppi: 62, ease: 69, tax: 25, inflation: 1.5, currency: 88 },
  { name: 'Croatia', code: 'HR', continent: 'Europe', gdp: 82, gdpGrowth: 2.8, pop: 4.0, internet: 90, mobile: 84, urban: 58, income: 20000, ppi: 70, ease: 74, tax: 18, inflation: 4.9, currency: 88 },
  { name: 'Slovakia', code: 'SK', continent: 'Europe', gdp: 132, gdpGrowth: 1.1, pop: 5.5, internet: 92, mobile: 84, urban: 54, income: 24000, ppi: 73, ease: 74, tax: 21, inflation: 10.5, currency: 88 },
  { name: 'Slovenia', code: 'SI', continent: 'Europe', gdp: 68, gdpGrowth: 1.7, pop: 2.1, internet: 90, mobile: 83, urban: 56, income: 32000, ppi: 78, ease: 76, tax: 19, inflation: 6.8, currency: 90 },
  { name: 'Luxembourg', code: 'LU', continent: 'Europe', gdp: 85, gdpGrowth: 1.9, pop: 0.66, internet: 97, mobile: 88, urban: 92, income: 126000, ppi: 95, ease: 83, tax: 17, inflation: 2.9, currency: 90 },
  { name: 'Iceland', code: 'IS', continent: 'Europe', gdp: 27, gdpGrowth: 2.8, pop: 0.37, internet: 99, mobile: 99, urban: 94, income: 78000, ppi: 90, ease: 79, tax: 20, inflation: 8.7, currency: 80 },
  { name: 'Jordan', code: 'JO', continent: 'Asia', gdp: 50, gdpGrowth: 2.6, pop: 10, internet: 88, mobile: 91, urban: 92, income: 5000, ppi: 45, ease: 69, tax: 20, inflation: 2.1, currency: 72 },
  { name: 'Lebanon', code: 'LB', continent: 'Asia', gdp: 23, gdpGrowth: -0.5, pop: 5.5, internet: 90, mobile: 96, urban: 90, income: 3400, ppi: 28, ease: 35, tax: 15, inflation: 221, currency: 5 },
  { name: 'Bahrain', code: 'BH', continent: 'Asia', gdp: 44, gdpGrowth: 2.6, pop: 1.5, internet: 100, mobile: 100, urban: 100, income: 29000, ppi: 78, ease: 76, tax: 0, inflation: 1.0, currency: 94 },
  { name: 'Oman', code: 'OM', continent: 'Asia', gdp: 108, gdpGrowth: 1.3, pop: 4.8, internet: 98, mobile: 95, urban: 87, income: 22500, ppi: 72, ease: 68, tax: 15, inflation: 0.9, currency: 90 },
  { name: 'Georgia', code: 'GE', continent: 'Asia', gdp: 30, gdpGrowth: 7.5, pop: 3.7, internet: 79, mobile: 78, urban: 60, income: 8100, ppi: 48, ease: 74, tax: 15, inflation: 2.5, currency: 62 },
  { name: 'Armenia', code: 'AM', continent: 'Asia', gdp: 24, gdpGrowth: 7.6, pop: 3.0, internet: 80, mobile: 84, urban: 63, income: 8000, ppi: 48, ease: 73, tax: 18, inflation: 2.5, currency: 62 },
  { name: 'Kyrgyzstan', code: 'KG', continent: 'Asia', gdp: 13, gdpGrowth: 5.6, pop: 6.9, internet: 72, mobile: 84, urban: 38, income: 1900, ppi: 28, ease: 62, tax: 10, inflation: 10.8, currency: 52 },
  { name: 'Mongolia', code: 'MN', continent: 'Asia', gdp: 19, gdpGrowth: 5.4, pop: 3.4, internet: 72, mobile: 89, urban: 68, income: 5700, ppi: 40, ease: 68, tax: 10, inflation: 12.5, currency: 55 },
  { name: 'Laos', code: 'LA', continent: 'Asia', gdp: 15, gdpGrowth: 4.0, pop: 7.4, internet: 55, mobile: 76, urban: 38, income: 2100, ppi: 28, ease: 54, tax: 24, inflation: 31.2, currency: 35 },
  { name: 'Brunei', code: 'BN', continent: 'Asia', gdp: 15, gdpGrowth: 1.0, pop: 0.45, internet: 97, mobile: 94, urban: 79, income: 33500, ppi: 80, ease: 73, tax: 18.5, inflation: 0.4, currency: 88 },
  { name: 'Maldives', code: 'MV', continent: 'Asia', gdp: 6, gdpGrowth: 4.8, pop: 0.55, internet: 83, mobile: 95, urban: 41, income: 10800, ppi: 58, ease: 70, tax: 15, inflation: 2.9, currency: 75 },
  { name: 'Bhutan', code: 'BT', continent: 'Asia', gdp: 3, gdpGrowth: 4.5, pop: 0.78, internet: 73, mobile: 90, urban: 43, income: 3800, ppi: 32, ease: 65, tax: 25, inflation: 4.1, currency: 70 },
  { name: 'Libya', code: 'LY', continent: 'Africa', gdp: 50, gdpGrowth: 12.9, pop: 7.0, internet: 84, mobile: 93, urban: 81, income: 7200, ppi: 42, ease: 35, tax: 20, inflation: 3.5, currency: 22 },
  { name: 'Tunisia', code: 'TN', continent: 'Africa', gdp: 46, gdpGrowth: 0.4, pop: 12, internet: 77, mobile: 83, urban: 71, income: 3800, ppi: 40, ease: 62, tax: 15, inflation: 9.3, currency: 45 },
  { name: 'Cameroon', code: 'CM', continent: 'Africa', gdp: 45, gdpGrowth: 3.9, pop: 27, internet: 36, mobile: 84, urban: 57, income: 1680, ppi: 22, ease: 48, tax: 33, inflation: 3.7, currency: 55 },
  { name: 'Mozambique', code: 'MZ', continent: 'Africa', gdp: 20, gdpGrowth: 5.0, pop: 32, internet: 22, mobile: 46, urban: 37, income: 640, ppi: 14, ease: 55, tax: 32, inflation: 7.1, currency: 45 },
  { name: 'Zambia', code: 'ZM', continent: 'Africa', gdp: 29, gdpGrowth: 4.0, pop: 20, internet: 25, mobile: 55, urban: 46, income: 1440, ppi: 18, ease: 57, tax: 35, inflation: 10.3, currency: 35 },
  { name: 'Zimbabwe', code: 'ZW', continent: 'Africa', gdp: 28, gdpGrowth: 5.5, pop: 16, internet: 40, mobile: 50, urban: 32, income: 1750, ppi: 22, ease: 50, tax: 25, inflation: 87.0, currency: 15 },
  { name: 'Benin', code: 'BJ', continent: 'Africa', gdp: 17, gdpGrowth: 6.4, pop: 13, internet: 38, mobile: 62, urban: 49, income: 1340, ppi: 18, ease: 55, tax: 30, inflation: 2.8, currency: 62 },
  { name: 'Paraguay', code: 'PY', continent: 'South America', gdp: 40, gdpGrowth: 4.7, pop: 7.4, internet: 76, mobile: 79, urban: 63, income: 5600, ppi: 44, ease: 56, tax: 10, inflation: 4.6, currency: 68 },
  { name: 'Uruguay', code: 'UY', continent: 'South America', gdp: 77, gdpGrowth: 2.5, pop: 3.5, internet: 92, mobile: 91, urban: 96, income: 22000, ppi: 68, ease: 70, tax: 25, inflation: 7.4, currency: 72 },
  { name: 'Venezuela', code: 'VE', continent: 'South America', gdp: 97, gdpGrowth: 5.0, pop: 28, internet: 72, mobile: 86, urban: 89, income: 3500, ppi: 20, ease: 25, tax: 34, inflation: 400, currency: 5 },
  { name: 'Cuba', code: 'CU', continent: 'North America', gdp: 108, gdpGrowth: 1.8, pop: 11, internet: 73, mobile: 60, urban: 77, income: 9700, ppi: 28, ease: 32, tax: 35, inflation: 38, currency: 30 },
  { name: 'Jamaica', code: 'JM', continent: 'North America', gdp: 17, gdpGrowth: 1.5, pop: 2.8, internet: 82, mobile: 96, urban: 57, income: 6200, ppi: 46, ease: 63, tax: 25, inflation: 8.0, currency: 62 },
  { name: 'Trinidad', code: 'TT', continent: 'North America', gdp: 28, gdpGrowth: 2.0, pop: 1.5, internet: 85, mobile: 90, urban: 54, income: 18800, ppi: 64, ease: 60, tax: 25, inflation: 8.3, currency: 68 },
  { name: 'Malta', code: 'MT', continent: 'Europe', gdp: 17, gdpGrowth: 5.1, pop: 0.53, internet: 93, mobile: 88, urban: 94, income: 32000, ppi: 78, ease: 77, tax: 35, inflation: 5.1, currency: 90 },
  { name: 'Cyprus', code: 'CY', continent: 'Europe', gdp: 32, gdpGrowth: 2.5, pop: 1.2, internet: 92, mobile: 87, urban: 67, income: 27000, ppi: 75, ease: 74, tax: 12.5, inflation: 3.5, currency: 90 },
  { name: 'Estonia', code: 'EE', continent: 'Europe', gdp: 38, gdpGrowth: 2.4, pop: 1.4, internet: 96, mobile: 89, urban: 70, income: 27000, ppi: 75, ease: 80, tax: 20, inflation: 9.1, currency: 88 },
  { name: 'Latvia', code: 'LV', continent: 'Europe', gdp: 41, gdpGrowth: -0.3, pop: 1.8, internet: 94, mobile: 83, urban: 69, income: 23000, ppi: 72, ease: 74, tax: 20, inflation: 8.9, currency: 88 },
  { name: 'Lithuania', code: 'LT', continent: 'Europe', gdp: 74, gdpGrowth: 0.5, pop: 2.8, internet: 94, mobile: 87, urban: 69, income: 26000, ppi: 73, ease: 77, tax: 15, inflation: 8.7, currency: 88 },
  { name: 'Bulgaria', code: 'BG', continent: 'Europe', gdp: 89, gdpGrowth: 1.8, pop: 6.5, internet: 91, mobile: 82, urban: 76, income: 14000, ppi: 66, ease: 72, tax: 10, inflation: 5.0, currency: 84 },
  { name: 'Serbia', code: 'RS', continent: 'Europe', gdp: 72, gdpGrowth: 2.5, pop: 6.8, internet: 89, mobile: 83, urban: 57, income: 10500, ppi: 62, ease: 68, tax: 15, inflation: 12.5, currency: 70 },
  { name: 'Bosnia', code: 'BA', continent: 'Europe', gdp: 24, gdpGrowth: 2.0, pop: 3.3, internet: 84, mobile: 79, urban: 50, income: 7200, ppi: 56, ease: 60, tax: 10, inflation: 3.0, currency: 78 },
  { name: 'North Macedonia', code: 'MK', continent: 'Europe', gdp: 15, gdpGrowth: 2.0, pop: 2.1, internet: 85, mobile: 78, urban: 58, income: 7200, ppi: 55, ease: 67, tax: 10, inflation: 9.4, currency: 75 },
  { name: 'Albania', code: 'AL', continent: 'Europe', gdp: 22, gdpGrowth: 3.4, pop: 2.8, internet: 82, mobile: 79, urban: 64, income: 7900, ppi: 52, ease: 63, tax: 15, inflation: 4.8, currency: 72 },
  { name: 'Moldova', code: 'MD', continent: 'Europe', gdp: 15, gdpGrowth: 1.5, pop: 2.6, internet: 80, mobile: 80, urban: 43, income: 5700, ppi: 40, ease: 60, tax: 12, inflation: 12.8, currency: 52 },
  { name: 'Belarus', code: 'BY', continent: 'Europe', gdp: 73, gdpGrowth: 3.9, pop: 9.4, internet: 86, mobile: 80, urban: 80, income: 7800, ppi: 52, ease: 49, tax: 18, inflation: 5.7, currency: 42 },
]

function gdpPerCapita(gdp: number, pop: number) {
  return Math.round((gdp * 1000) / pop)
}
function consumerSpending(gdp: number, income: number) {
  return Math.round(gdp * Math.min(0.72, 0.45 + (income / 100000) * 0.27) * 10) / 10
}
function historicalGdp(currentGdp: number, growth: number) {
  const years = [2019, 2020, 2021, 2022, 2023, 2024]
  const result: Array<{ year: number; value: number }> = []
  let val = currentGdp
  for (let i = years.length - 1; i >= 0; i--) {
    const yr = years[i]
    if (i === years.length - 1) result.unshift({ year: yr, value: Math.round(val) })
    else {
      val = val / (1 + (growth / 100) * (yr === 2020 ? -1 : 1) * (yr === 2021 ? 0.8 : 1))
      result.unshift({ year: yr, value: Math.round(val) })
    }
  }
  return result
}
function historicalGrowth(baseGrowth: number) {
  return [2019, 2020, 2021, 2022, 2023, 2024].map((year, i) => {
    let g = baseGrowth + Math.sin(i * 2.3 + baseGrowth) * 1.5
    if (year === 2020) g = Math.min(g, -1.5)
    if (year === 2021) g = Math.max(g, baseGrowth * 1.4)
    return { year, value: Math.round(g * 10) / 10 }
  })
}

const INDUSTRIES = ['Technology', 'E-Commerce', 'FinTech', 'HealthTech', 'EdTech', 'Logistics', 'Manufacturing', 'Retail', 'Media', 'Agriculture']
function industryGrowth(gdpGrowth: number, internet: number): Record<string, number> {
  const out: Record<string, number> = {}
  INDUSTRIES.forEach((ind, i) => {
    const base = gdpGrowth + (i % 3 === 0 ? 3 : i % 3 === 1 ? 1.5 : -0.5)
    const techBoost = ['Technology', 'E-Commerce', 'FinTech'].includes(ind) ? (internet / 100) * 4 : 0
    out[ind] = Math.round((base + techBoost + Math.sin(i * 1.7) * 1.5) * 10) / 10
  })
  return out
}

/** Modeled scores (weights are editorial, not empirical). */
function computeScores(c: (typeof RAW_COUNTRIES)[0]) {
  const normalizedGdpPc = Math.min(100, (c.income / 100000) * 100)
  const marketAttractiveness = Math.round(
    normalizedGdpPc * 0.2 + c.ppi * 0.15 + Math.min(100, c.gdpGrowth * 8) * 0.2 + c.internet * 0.15 + c.ease * 0.15 + c.currency * 0.15,
  )
  const popScore = Math.min(100, Math.log10(c.pop * 10) * 30)
  const opportunityRaw = popScore * 0.2 + Math.min(100, c.gdpGrowth * 9) * 0.25 + (100 - c.internet) * 0.2 + c.ppi * 0.15 + Math.min(100, c.gdp / 100) * 0.2
  const opportunity = Math.round(Math.min(99, opportunityRaw * 1.28))
  const risk = Math.round((100 - c.currency) * 0.25 + Math.min(100, c.inflation * 1.2) * 0.25 + (100 - c.ease) * 0.2 + (100 - c.ppi) * 0.15 + c.tax * 1.5 * 0.15)
  const eoe = Math.round(c.ease * 0.35 + c.currency * 0.2 + c.internet * 0.15 + (100 - c.tax) * 0.15 + (100 - Math.min(100, c.inflation * 1.5)) * 0.15)
  return {
    marketAttractivenessScore: Math.max(0, Math.min(100, marketAttractiveness)),
    opportunityScore: Math.max(0, Math.min(100, opportunity)),
    riskScore: Math.max(0, Math.min(100, risk)),
    easeOfEntry: Math.max(0, Math.min(100, eoe)),
  }
}

let _markets: Market[] | null = null

export function generateMarkets(): Market[] {
  if (_markets) return _markets
  const seen = new Set<string>()
  _markets = RAW_COUNTRIES.filter((c) => {
    const key = `${c.code}|${c.name}`
    if (seen.has(key) || seen.has(c.code) || seen.has(c.name)) return false
    seen.add(key)
    seen.add(c.code)
    seen.add(c.name)
    return true
  }).map((c, i) => ({
    id: `market-${i + 1}`,
    name: c.name,
    code: c.code,
    continent: c.continent,
    gdp: c.gdp,
    gdpGrowth: c.gdpGrowth,
    gdpPerCapita: gdpPerCapita(c.gdp, c.pop),
    population: c.pop,
    internetPenetration: c.internet,
    mobileAdoption: c.mobile,
    urbanization: c.urban,
    avgIncome: c.income,
    purchasingPowerIndex: c.ppi,
    easeOfDoingBusiness: c.ease,
    taxRate: c.tax,
    inflationRate: c.inflation,
    currencyStability: c.currency,
    consumerSpending: consumerSpending(c.gdp, c.income),
    industryGrowth: industryGrowth(c.gdpGrowth, c.internet),
    historicalGdp: historicalGdp(c.gdp, c.gdpGrowth),
    historicalGrowth: historicalGrowth(c.gdpGrowth),
    ...computeScores(c),
  }))
  return _markets
}

/** Real distinct market count after dedup (NOT the old README's "121"). */
export const MARKET_COUNT = generateMarkets().length

const COMPETITOR_NAMES = ['Apex Solutions', 'Nexus Corp', 'Vortex Group', 'Orbit Ventures', 'Titan Markets', 'Echo Industries', 'Prism Holdings', 'Fusion Labs', 'Summit Partners', 'Crest Capital', 'Delta Systems', 'Helix Global', 'Zenith Corp', 'Stratos Group', 'Vega Holdings']

let _competitive: CompetitiveData[] | null = null
export function generateCompetitiveData(): CompetitiveData[] {
  if (_competitive) return _competitive
  _competitive = generateMarkets().map((m) => {
    const saturationBase = (m.gdpPerCapita / 100000) * 60 + (m.internetPenetration / 100) * 30
    const saturation = Math.min(95, Math.max(5, saturationBase + Math.sin(m.id.charCodeAt(7) || 1) * 15))
    const compCount = Math.round(3 + (saturation / 100) * 47)
    const concentration = Math.round(1000 + (saturation / 100) * 6000)
    const playerCount = Math.min(5, Math.round(compCount / 3))
    return {
      marketId: m.id,
      competitorCount: compCount,
      marketSaturation: Math.round(saturation),
      marketConcentration: concentration,
      competitiveDensity: Math.round(Math.min(95, saturation * 0.9 + 5)),
      topPlayers: Array.from({ length: playerCount }, (_, i) => ({
        name: COMPETITOR_NAMES[(m.code.charCodeAt(0) + i) % COMPETITOR_NAMES.length],
        marketShare: Math.round((30 - i * 5 + Math.sin(i * 2) * 5) * 10) / 10,
        strength: (['dominant', 'strong', 'moderate', 'weak'] as const)[Math.min(3, i)],
      })),
      competitivePressureScore: Math.min(100, Math.round(saturation * 0.6 + (concentration / 10000) * 40)),
      entryDifficultyScore: Math.min(100, Math.round((100 - m.easeOfEntry) * 0.5 + saturation * 0.3 + saturation * 0.6 * 0.2)),
    }
  })
  return _competitive
}

export function generateOpportunities(): Opportunity[] {
  const markets = generateMarkets()
  const compMap = new Map(generateCompetitiveData().map((c) => [c.marketId, c]))
  const out: Opportunity[] = []
  markets.forEach((m, i) => {
    const comp = compMap.get(m.id)!
    if (comp.marketSaturation < 35 && m.gdpGrowth > 5)
      out.push({ id: `opp-${i}-1`, marketId: m.id, marketName: m.name, type: 'blue_ocean', title: `Blue Ocean in ${m.name}`, description: `High growth (${m.gdpGrowth}% GDP) with low saturation (${comp.marketSaturation}%).`, opportunityScore: Math.round((m.opportunityScore + (100 - comp.marketSaturation)) / 2), marketPotential: Math.round(m.gdp * 0.08 * 1000), expectedRevenue: Math.round(m.gdp * 0.012 * 1000), confidenceScore: Math.round(65 + m.gdpGrowth * 3), timeHorizon: m.gdpGrowth > 7 ? 'short' : 'medium', drivers: [`${m.gdpGrowth}% GDP growth`, `Low saturation ${comp.marketSaturation}%`], risks: [`Currency stability ${m.currencyStability}/100`] })
    if (m.internetPenetration < 65 && m.gdpGrowth > 4)
      out.push({ id: `opp-${i}-2`, marketId: m.id, marketName: m.name, type: 'emerging', title: `Emerging Digital: ${m.name}`, description: `Accelerating digital adoption (${m.internetPenetration}% internet) in a largely untapped market.`, opportunityScore: Math.round((m.gdpGrowth * 8 + (100 - m.internetPenetration) * 0.4) / 2), marketPotential: Math.round(m.population * 45), expectedRevenue: Math.round(m.population * 6), confidenceScore: Math.round(55 + m.gdpGrowth * 2), timeHorizon: 'medium', drivers: [`${m.population}M population`, `${m.gdpGrowth}% growth`], risks: ['Infrastructure limits', 'Regulatory uncertainty'] })
    if (m.purchasingPowerIndex > 65 && comp.marketSaturation < 50)
      out.push({ id: `opp-${i}-3`, marketId: m.id, marketName: m.name, type: 'underserved', title: `Premium Underserved: ${m.name}`, description: `Strong purchasing power (PPI ${m.purchasingPowerIndex}) with limited premium competition.`, opportunityScore: Math.round((m.purchasingPowerIndex + (100 - comp.marketSaturation)) / 2), marketPotential: Math.round(m.consumerSpending * 150), expectedRevenue: Math.round(m.consumerSpending * 20), confidenceScore: Math.round(70 + (m.easeOfDoingBusiness - 60) * 0.5), timeHorizon: 'short', drivers: [`PPI ${m.purchasingPowerIndex}`, `Consumer spend $${m.consumerSpending}B`], risks: ['Incumbent response'] })
    if (m.population > 50 && m.gdpGrowth > 3)
      out.push({ id: `opp-${i}-4`, marketId: m.id, marketName: m.name, type: 'growth_surge', title: `Mass Market Surge: ${m.name}`, description: `${m.population}M population with ${m.gdpGrowth}% GDP growth — large addressable market.`, opportunityScore: Math.min(99, Math.round(m.gdpGrowth * 8 + Math.log10(m.population) * 15)), marketPotential: Math.round(m.gdp * 0.12 * 1000), expectedRevenue: Math.round(m.gdp * 0.015 * 1000), confidenceScore: Math.round(60 + m.gdpGrowth * 2.5), timeHorizon: 'medium', drivers: [`${m.population}M base`, `${m.gdpGrowth}% growth`], risks: ['Local competition', 'Logistics'] })
  })
  return out.sort((a, b) => b.opportunityScore - a.opportunityScore).slice(0, 150)
}

# Contrôle des règles Excel et du bilan J−1

Classeur source : `QOS - TRS atelier Injection.xlsx`, relu sans modification.

Les 63 relevés ont été comparés aux cellules de `Saisie_Donnees`, lignes sources conservées dans `source_row`.

- A à D : dates, postes, presses et codes moules préservés.
- E : désignation retrouvée par code article.
- F, G, I, J, K : ouverture et quatre catégories d’arrêt préservées.
- H : temps requis = F − G.
- L : temps machine = H − I − J − K.
- M : quantité totale = N + O + P.
- N, O, P : conformes et deux catégories de rebuts préservées.
- Q : cycle par pièce, calculé depuis le cycle du moule / nombre d’empreintes.
- R : disponibilité = L / H, non calculable si H = 0.
- S : performance = M × Q / (L × 60), non calculable si L = 0.
- T : qualité = N / M, non calculable si M = 0.
- U : TRS = N × Q / (H × 60), équivalent au produit R × S × T avec production. Un poste requis sans production vaut 0 ; une fermeture sans temps requis est non calculable.
- V : temps standard par pièce importé du classeur, conservé dans chaque relevé.
- W : heures de main-d’œuvre préservées.
- X : recette = V × N / 3600.
- Y : DLE = X / W, non calculable si W = 0.

Les **12 colonnes calculées** E, H, L, M, Q, R, S, T, U, V, X, Y sont couvertes par les tests de comparaison. Les cycles des trois moules utilisent huit empreintes : 39/8, 38/8 et 30/8 secondes par pièce. Modifier un article ne recalcule pas rétroactivement les relevés existants.

Le `Dashboard_TRS` du fichier source contient 20 erreurs `#DIV/0!`, avec des références limitées aux premières lignes et des noms de presse différents. Le site utilise les vraies presses et l’ensemble des relevés filtrés. Les taux de synthèse sont pondérés par les temps/quantités appropriés. Les valeurs supérieures à 100 % sont conservées et signalées.

Le classeur n’indique pas les heures de début/fin de chaque arrêt. Ses totaux permettent le Pareto, les temps par poste et le bilan par presse, mais pas une reconstitution horaire exacte. Le journal complète ces informations avec début, fin et cause. Il calcule automatiquement les quatre catégories de durée, sans les compter une seconde fois dans les indicateurs Excel.

Le bilan J−1 porte sur les relevés dont la date de début du poste est la veille. Les arrêts de nuit après minuit restent associés à ce poste. Les heures de plusieurs presses sont des heures-machine cumulées. L’absence d’un relevé est distinguée d’un arrêt déclaré. Un chevauchement de journaux sur une même presse est refusé en local et par la migration SQL `04_daily_review.sql` pour les nouvelles écritures.

Vérifications reproductibles : `npm test`, `npm exec playwright test`, `npm run build`. La base SQL est testée sur PostgreSQL embarqué PGlite. L’exécution des migrations sur le projet Supabase réel reste à effectuer dans SQL Editor.

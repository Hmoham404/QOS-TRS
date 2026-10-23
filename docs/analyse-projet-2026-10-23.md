# Analyse du projet QOS · Atelier Injection

Analyse effectuée le **23 octobre 2026**, sur le commit `c4939fe`.

## Avis général

Le projet dispose d'un socle métier solide pour le suivi manuel d'un atelier d'injection : calculs centralisés, conservation des cycles historiques, contraintes SQL, distinctions entre absence de saisie et arrêt déclaré, tests de parcours et fonctionnement hors connexion.

Les premières corrections devraient concerner la gestion des brouillons et des modifications simultanées. Deux problèmes ont été reproduits dans le navigateur : écrasement d'un brouillon entre onglets et impossibilité de repartir proprement après un conflit. Les tests existants passent, mais ne couvraient pas ces scénarios.

L'accès Supabase public est une décision explicite de la version actuelle. Il faut l'évaluer comme un choix de fonctionnement : il permet aussi à un visiteur de modifier les données et références de l'atelier. La présence de RLS ne crée pas de restriction entre visiteurs lorsque ses politiques autorisent toutes les lignes.

## 1. Fonctionnement et architecture

Application React 19, construite avec Vite et Tailwind CSS 4. Graphiques Recharts, icônes Lucide et polices embarquées. Le frontend communique directement avec Supabase ; il n'y a pas de serveur applicatif métier dans ce dépôt.

Parcours disponibles :

- Bilan J−1 par presse et poste, avec chronologie si les horaires sont renseignés.
- Tableau de bord TRS, disponibilité, performance, qualité et DLE.
- Courbes ou histogrammes de TRS, DLE et réalisation du planning ; analyse des pertes.
- Saisie, modification et historique des relevés ; journal détaillé des arrêts.
- Gestion et archivage des presses et articles.
- Export CSV, sauvegarde JSON et conversion d'une sauvegarde en SQL.
- PWA avec cache de l'application, brouillons et mises à jour volontaires.
- APK Android : client WebView du site HTTPS `qos-trs.vercel.app`, avec export et impression natifs.

Répartition du code :

- `src/domain.js` : calculs, agrégation et validations de base.
- `src/analytics.js`, `src/daily.js`, `src/curves.js` : chronologies, bilan journalier et indicateurs dans le temps.
- `src/data.js` : lecture/écriture locale et Supabase, cache des dernières données.
- `src/drafts.js`, `src/Entry.jsx`, `src/DraftList.jsx` : conservation et reprise de saisie.
- `src/App.jsx` : navigation, état global, filtres, historique et configuration.
- `supabase/01` à `05` : schéma, import Excel et migrations métier.
- `scripts/pwa-build.js`, `scripts/sw-template.js` : service worker versionné.
- `android/` : enveloppe native ; la logique de production reste dans le site.

Deux modes de données existent :

1. **Local** : données initiales du classeur puis sauvegarde dans `localStorage`. Les données restent propres au navigateur et à l'origine du site.
2. **Partagé** : données Supabase, copie locale de la dernière lecture réussie, brouillons propres à l'appareil. L'envoi d'un brouillon exige une action d'enregistrement en ligne.

Lors de cet examen, la configuration effective du build local ne contient ni URL ni clé Supabase. Les parcours ont donc été vérifiés en mode local, dans des contextes navigateur isolés. Le comportement réel du déploiement et de sa base n'a pas été contrôlé.

## 2. Résultats vérifiés

- **27/27 tests métier et SQL réussis** avec `npm test`.
- **10/10 parcours UI existants réussis**, avec Edge headless et un serveur local dédié.
- **4/4 scénarios PWA réussis**, sur un build local isolé : hors connexion, brouillons, mise à jour, instructions d'installation et téléchargement APK.
- **2 scénarios supplémentaires réussis pour reproduire les anomalies** décrites ci-dessous. Leur succès confirme la présence des problèmes ; ce ne sont pas des correctifs.
- **Build standard `npm run build` réussi**. L'essai initial était bloqué par les permissions du bac à sable Windows lors du chargement esbuild de la configuration. Le build avec `--configLoader native`, puis la commande standard avec les permissions de lecture nécessaires, ont abouti.
- **Audit npm : 0 vulnérabilité connue signalée**, sur l'arbre de dépendances installé à la date de l'analyse. Cela ne couvre pas les erreurs métier ou les choix de droits d'accès.
- Captures desktop et mobile examinées ; les tests vérifient l'absence de débordement global à 390 px.

Les tests de comparaison Excel utilisent l'extraction versionnée `docs/workbook-analysis.json`, et non une relecture du fichier `.xlsx` à chaque exécution. Ils confirment la cohérence des 63 relevés avec cette extraction ; le classeur binaire n'a pas été réextrait pendant cet audit.

Les durées affichées par Playwright incluent un délai de fermeture des serveurs sous Windows. Les processus de serveurs créés pour l'audit ont été arrêtés après les assertions.

## 3. Points forts métier

### Calculs et qualité des indicateurs

Le TRS global est calculé depuis les temps théoriques cumulés des pièces conformes et les temps requis cumulés. Il n'utilise pas une moyenne simple des pourcentages par ligne. Les taux dont le dénominateur est nul restent non calculables ; un poste avec du temps requis mais aucune production a un TRS nul.

Les valeurs supérieures à 100 % restent visibles et signalées. Le calcul des pertes sépare les gains de cadence des parts positives. Le planning exclut des deux quantités les relevés sans plan, et distingue un plan absent d'un plan égal à zéro.

Les données de référence embarquées représentent 16 presses, 3 articles et 63 relevés : 219 520 pièces conformes, 1 250 rebuts, 311,5 heures machine, TRS agrégé de 80,7 %. Ce sont les données initiales du projet, pas une mesure de la production actuelle.

### Cohérence de l'historique et des horaires

Les cycles et standards sont conservés dans chaque relevé. Une modification des paramètres d'un article ne recalcule pas automatiquement le passé. Le SQL applique également cette règle.

La date de production est celle du début du poste ; une nuit peut se terminer à J+1. Les arrêts sont validés pour éviter chevauchements, dépassements et incohérence avec les totaux. Le serveur SQL protège également les chevauchements de journaux d'une presse.

La chronologie historique ne prétend pas connaître des horaires absents du classeur. Les mentions « marche déclarée » et « non renseignée » rendent cette limite compréhensible.

### Sauvegarde et hors connexion

Les brouillons sont écrits lors de la modification des champs. Une mise à jour PWA peut être bloquée si leur sauvegarde a échoué. Une panne Supabase ne provoque pas de basculement silencieux vers les données initiales locales. Le service worker exclut les requêtes Supabase et les téléchargements APK de son cache de ressources.

## 4. Anomalies et risques à traiter

### F1 — Priorité haute : brouillon bloqué après un conflit

**Statut : reproduit dans le navigateur en mode local.**

Un premier onglet prépare une modification. Un second enregistre une version plus récente du même relevé. Le premier reçoit correctement un refus de concurrence, mais sa version de brouillon conserve l'ancien `updated_at`. Après actualisation et réouverture du relevé, ce brouillon est restauré automatiquement et l'enregistrement est de nouveau refusé.

L'interface propose seulement de reprendre les brouillons, sans action pour les abandonner. L'utilisateur ne peut donc pas repartir simplement de la version enregistrée depuis ce parcours. Le même mécanisme de restauration est utilisé en mode Supabase ; sa reproduction sur une base partagée reste à faire.

**Sources :** `src/Entry.jsx:15-16`, `src/Entry.jsx:34`, `src/data.js:59`, `src/data.js:75`, `src/DraftList.jsx:7`.

**Correction proposée :** proposer « Abandonner le brouillon et recharger la version enregistrée » et un écran de résolution conservant une copie des modifications locales. Ne pas remplacer automatiquement la date de version pour forcer l'écriture : cela contournerait la protection contre l'écrasement.

### F2 — Priorité moyenne : brouillons partagés entre onglets

**Statut : reproduit dans le navigateur.**

Deux nouvelles saisies ouvertes depuis la navigation générale utilisent la même clé de brouillon. Si A écrit un commentaire puis B un autre, A récupère celui de B après avoir quitté puis rouvert la saisie. Une sauvegarde réussie dans un onglet peut aussi retirer le brouillon partagé utilisé par l'autre.

**Sources :** `src/drafts.js:3`, `src/Entry.jsx:14-22`, `src/Entry.jsx:34`.

**Correction proposée :** attribuer une identité persistante à chaque brouillon de nouvelle saisie, proposer un choix explicite à la reprise et détecter les écritures concurrentes sur un même brouillon. Pour la modification d'un relevé, signaler qu'un autre onglet a changé le brouillon.

### F3 — Priorité moyenne : tests UI insuffisamment isolés de Supabase

**Statut : constat de configuration et de code ; aucune écriture de test en production effectuée.**

La configuration Playwright standard démarre `npm run dev` avec l'environnement habituel et autorise la réutilisation du serveur déjà présent sur le port 5173. Les tests UI contiennent des ajouts de relevés, presses et articles. Si ce serveur utilise Supabase et que les préconditions des tests sont remplies, ces écritures peuvent atteindre la base configurée.

Le contexte navigateur isolé sépare les cookies et le stockage local ; il n'isole pas une base distante. Pour cet audit, les variables Supabase ont été explicitement vidées dans le processus enfant et les serveurs UI ont utilisé des ports dédiés.

**Sources :** `playwright.config.js:2`, `tests/ui.spec.js:2`, `tests/planning.spec.js:2`, `src/data.js:56-60`.

**Correction proposée :** imposer le mode local dans la configuration des tests de parcours, refuser les hôtes Supabase externes pour ces tests et utiliser une base de test dédiée pour les tests d'intégration cloud.

### F4 — Priorité moyenne : références sans protection contre une modification concurrente

**Statut : constat de code, sans reproduction multi-appareil.**

Les relevés disposent d'une protection par `updated_at`, mais les presses et articles sont enregistrés par `upsert` de l'objet complet. Deux personnes modifiant une référence peuvent écraser des champs l'une de l'autre, par exemple un changement de cycle ou un archivage.

**Sources :** `src/data.js:81-91`, `src/References.jsx:10`, `supabase/01_schema.sql:17-29`.

**Correction proposée :** ajouter une version aux références et appliquer une écriture conditionnelle, avec retour explicite en cas de conflit.

## 5. Accès public : décision à maintenir en connaissance de cause

La migration `05` autorise `SELECT`, `INSERT` et `UPDATE` pour les rôles `anon` et `authenticated` sur les presses, articles et relevés, avec des politiques toujours vraies. `App.jsx` fixe le rôle d'interface à `admin`. Il n'existe donc pas de séparation effective entre lecteur, opérateur et administrateur dans le fonctionnement courant.

Cela correspond à la documentation « accès direct sans compte ». Le lien et la clé publique permettent la lecture et la modification ; ils ne constituent pas une identité d'utilisateur. La suppression reste refusée, mais l'historique peut être modifié et les références archivées. Les nouvelles saisies publiques n'identifient pas leur auteur. Il n'y a pas de journal détaillé des versions avant/après dans le schéma fourni.

Si ce fonctionnement est voulu pour l'atelier, conserver cette limite visible. Si les données doivent être confidentielles, ou les modifications attribuées à une personne, prévoir une authentification et des politiques adaptées. Ne pas changer ce mode dans le cadre d'une simple correction des brouillons.

Références : `supabase/05_planning_public_access.sql:21-30`, `src/App.jsx:28`, `src/data.js:11` et documentation officielle [RLS Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security), [protection des données Supabase](https://supabase.com/docs/guides/database/secure-data). Les variables `VITE_` sont intégrées au code navigateur, conformément à la [documentation Vite](https://vite.dev/guide/env-and-mode).

## 6. Performance, expérience utilisateur et maintenance

### Croissance de l'historique

`loadData()` recharge toutes les presses, tous les articles et tous les relevés, par lots de 1 000, puis garde l'ensemble dans le navigateur. Hors saisie, les vues partagées actualisent chaque minute et au retour de l'application. La pagination de l'historique est uniquement visuelle, après téléchargement de toutes les lignes.

Ce fonctionnement convient au petit jeu initial. Pour 16 presses et 3 relevés quotidiens par presse, une année représente jusqu'à 17 520 relevés, davantage si plusieurs articles se succèdent dans un poste. Ce chiffre est une projection, pas le volume observé.

Évolution proposée : filtres de date/presse/poste et pagination côté base ; requêtes de synthèse adaptées ; synchronisation des changements plutôt que téléchargement complet. Mesurer ensuite sur un jeu représentatif. Aucun test de charge n'a été réalisé.

### Ressources et mobile

Le build produit environ 1,05 Mo de JavaScript brut, soit 296 ko gzip, et 114 ko de CSS brut, soit 24,5 ko gzip, hors polices et images. Les pages sont importées statiquement ; Recharts et Supabase ont déjà leurs chunks distincts. Le précache PWA inclut aussi les variantes de polices WOFF et WOFF2.

Pistes : charger les écrans d'analyse à la demande, limiter les fontes réellement nécessaires au précache et mesurer le premier affichage sur un téléphone représentatif. Ces tailles ne constituent pas, à elles seules, une preuve de lenteur.

La navigation mobile tient dans 390 px. Le formulaire complet atteint environ 4 000 px de hauteur sur la capture de test ; l'enregistrement est en bas. Une action d'enregistrement facilement accessible et une proposition d'installation moins présente après la première visite faciliteraient la saisie répétitive. Aucun audit complet d'accessibilité n'a été réalisé.

### Lisibilité et automatisation

Plusieurs fichiers concentrent beaucoup de logique et de JSX dans de très longues lignes. `styles.css` contient environ 39 ko sur 13 lignes et `upgrade.css` environ 27 ko sur 8 lignes. Cela complique les revues, la localisation des modifications et les conflits Git.

Étapes utiles : formatage cohérent, extraction de l'historique/configuration hors de `App.jsx`, suppression des imports inutilisés, lint, puis vérifications automatiques du build et des tests. Aucun workflow CI versionné n'a été trouvé. Une réécriture complète ou un changement de framework n'est pas justifié par les constats de cet audit.

### Fonction PDF et documentation

Le rapport PDF quotidien dédié ajouté au commit `201271f` a été retiré au commit `90360ea`, avec son composant et son test. La version actuelle comporte des styles d'impression génériques et une passerelle d'impression Android ; elle n'expose plus ce rapport dédié. C'est un changement de périmètre observé, pas un défaut de calcul.

Les guides mentionnent encore d'anciens nombres de tests et des états différents de validation du déploiement. Les mettre à jour avec la date, le commit et le périmètre précis des contrôles rendrait l'exploitation plus claire.

## 7. Ordre de travail proposé

1. Débloquer les brouillons en conflit, avec choix explicite et conservation des modifications.
2. Donner une identité propre aux nouvelles saisies et protéger les brouillons entre onglets.
3. Garantir l'isolement local des tests UI et ajouter les deux scénarios reproduits aux tests de non-régression après correction.
4. Protéger les modifications concurrentes des références.
5. Adapter le chargement des données à la croissance réelle de l'atelier.
6. Améliorer progressivement lisibilité, automatisation et confort de saisie mobile.

Le mode d'accès public mérite une décision fonctionnelle distincte. Il ne doit pas être modifié implicitement pendant ces corrections.

## 8. Périmètre et fichiers produits

Aucun changement de logique applicative, de migration, de dépendance ou de configuration de production. Aucun déploiement ni envoi de données de test à Supabase. Le build a régénéré `dist`, qui est ignoré par Git.

Les configurations, le build local isolé et les deux reproductions se trouvent dans `.runtime/`, également ignoré par Git : `audit-run.mjs`, `audit-ui.config.mjs`, `audit-pwa.config.mjs`, `audit-findings.config.mjs` et `audit-findings.spec.mjs`.

Commandes de l'audit :

```powershell
npm test
npm run build
npm audit --json --cache .runtime/npm-cache
node .runtime/audit-run.mjs ui
node .runtime/audit-run.mjs build
node .runtime/audit-run.mjs pwa
node .runtime/audit-run.mjs findings
```

Les scripts `.runtime` utilisent le chargeur natif de Vite et des variables Supabase vides. Pour vérifier la PWA, exécuter d'abord le build local isolé. Les tests de constat sont temporaires ; ils attendent le comportement défectueux décrit plus haut.

Non vérifiés : état du site publié, migrations réellement installées sur Supabase, installation sur téléphone physique, signature APK par les outils Android, comportement Safari réel, sauvegarde de la clé Android, conformité de tout le classeur binaire et performances sous charge.

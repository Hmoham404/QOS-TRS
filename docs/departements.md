# Espaces Métallisation, Sérigraphie et Assemblage

Les trois départements disposent des mêmes parcours qu’Injection : bilan journalier, vue d’ensemble, courbes, saisie, journal des arrêts, historique, références, exports Excel/CSV et sauvegarde JSON.

Chaque département possède une couleur d’identification : émeraude pour Injection, bleu cobalt pour Assemblage, graphite et bleu glacier pour Métallisation, prune pour Sérigraphie et jaune doré pour Soudure. Elle s’applique au menu, aux boutons principaux, aux bandeaux et aux repères de navigation, en jour comme en nuit. Cinq emblèmes SVG originaux représentent respectivement un moule, des pièces assemblées, une pièce métallisée, un cadre de sérigraphie et une torche de soudure. Le nom et le logo du département restent visibles sur mobile. Les couleurs de statut et des causes de pertes conservent leur signification métier.

## Paramètres fournis

La Métallisation contient six références : Cover KIKO `2.3.30156`, Base KIKO `2.4.30050`, Cover PM Belotti `11600CO`, Base PM Belotti `11600BD`, et Cover GM Belotti `12900CO` et `12900BD`. Les quatre premières utilisent un cycle de 0,75 s et un standard de 22,5 s ; les deux dernières un cycle de 1,036 s et un standard de 31,08 s. L’effectif standard est de 30 et les objectifs TRS et DLE de 70 %.

La Sérigraphie contient Base KIKO `2.4.30051` : cycle de 5 s, standard de 7,5 s, effectif standard de 1,5 et objectifs TRS/DLE de 80 %.

L’Assemblage contient Compact KIKO `3.3.30273` : cycle de 3,26 s, standard de 42,35 s, effectif standard de 13 et objectifs TRS/DLE de 80 %.

Ces cycles sont utilisés directement **par pièce**, sans division par un nombre d’empreintes. Les temps standards proviennent des tableaux ; ils ne sont pas recalculés depuis l’effectif standard. Les deux références GM portent le même libellé « Cover GM Belotti », conformément à la source ; leur code les distingue.

## Équipements et données

Une ligne initiale configurable est proposée dans chaque espace (« Ligne Métallisation », « Ligne Sérigraphie », « Ligne Assemblage »). Il s’agit d’un point de saisie à renommer ou compléter avec les équipements réels, sans prétendre inventorier tout l’atelier.

Aucun relevé de production n’est inventé ou copié depuis Injection. Soudure conserve son espace réservé en attendant ses paramètres.

Les références, relevés, filtres, brouillons, caches hors connexion et préférences d’objectif sont séparés par département. Injection conserve sa clé de stockage existante et ses données. Les sauvegardes JSON et fichiers Excel identifient le département.

## Pertes

Les causes communes sont : manque d’effectif, problème qualité, rupture MP, coupure d’énergie, réglage, démarrage/arrêt, changement de référence et autres pertes.

- Métallisation ajoute « Panne Vaccum » et « Panne ligne de peinture ».
- Sérigraphie ajoute « Panne machine » et « Panne four ».
- Assemblage ajoute « Panne machine ».

Le doublon « Problème qualité » des tableaux est regroupé en une seule catégorie. Les pauses planifiées restent disponibles séparément, comme dans Injection. Les causes sont reprises dans les champs de durée, le journal horodaté, le Pareto, le bilan journalier, les courbes de pertes et les exports.

Pour préserver la compatibilité du schéma et des sauvegardes, `mold_breakdown_min` désigne la panne Vaccum en Métallisation ; `peripherals_min` désigne la panne de ligne de peinture en Métallisation et la panne du four en Sérigraphie. Le département permet de traduire ces champs en causes métier. Les catégories qui ne concernent pas un département sont refusées par les validations locales et SQL.

## DLE et historique

`DLE = pièces conformes × temps standard / (heures réellement dépensées × 3600)`.

L’effectif standard est une référence, distincte des heures réellement dépensées. Ces dernières sont saisies par l’utilisateur, en cumulant le travail de toutes les personnes affectées. Les nouveaux espaces ne proposent pas de valeur réelle inventée : sans heures dépensées, le DLE est non calculable.

Les cycles, standards, effectifs standards et objectifs sont conservés dans chaque relevé. Modifier un article s’applique aux futures saisies ; modifier un ancien relevé avec le même article conserve ses paramètres historiques. Changer l’article d’un relevé recharge les paramètres du nouvel article.

Les objectifs par article apparaissent dans les références et la saisie. Les courbes utilisent les objectifs historiques des relevés, pondérés par le temps requis pour le TRS et par les heures dépensées pour le DLE. Sans relevé, les objectifs initiaux du département sont affichés.

## Activation de la base partagée

En mode local, les catalogues sont disponibles directement.

Pour une base Supabase existante, appliquer **`supabase/07_departments.sql` après les migrations 01 à 06**, puis republier le frontend. La migration :

- attribue les données existantes à Injection ;
- permet de réutiliser un code article ou un nom d’équipement dans des départements différents ;
- interdit de relier un relevé à un équipement ou article d’un autre département ;
- interdit de déplacer une référence ou un relevé existant vers un autre département ;
- installe les catalogues initiaux sans écraser les références déjà présentes ;
- conserve les calculs, droits d’accès public et protections horaires existants.

La migration peut être rejouée. Elle ne crée aucun relevé de production. Une ancienne base peut continuer à ouvrir Injection ; les nouveaux espaces affichent la migration nécessaire au lieu d’utiliser les données Injection ou une base locale de substitution.

La reprise SQL d’une sauvegarde d’un nouveau département nécessite également la migration 07. Les références déjà présentes sont conservées, comme pour la reprise Injection ; pour une restauration de références modifiées, vérifier ces conflits avant l’import.

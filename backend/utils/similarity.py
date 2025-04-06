from typing import List, Set

def calculate_jaccard_similarity(set1: Set[str], set2: Set[str]) -> float:
    """
    Calculate Jaccard similarity between two sets of strings.
    
    Args:
        set1: First set of strings
        set2: Second set of strings
        
    Returns:
        float: Jaccard similarity coefficient between 0 and 1
    """
    if not set1 or not set2:
        return 0.0
        
    intersection = len(set1.intersection(set2))
    union = len(set1.union(set2))
    
    return intersection / union if union > 0 else 0.0

def calculate_entity_similarities(entities: List[str]) -> List[dict]:
    """
    Calculate Jaccard similarities between all pairs of entities.
    
    Args:
        entities: List of entity strings to compare
        
    Returns:
        List[dict]: List of similarity pairs with their scores
    """
    # Convert entities to sets of words
    entity_sets = {
        entity: set(entity.lower().split()) 
        for entity in entities
    }
    
    similarities = []
    
    # Calculate similarities for all unique pairs
    for i, entity1 in enumerate(entities):
        for entity2 in entities[i+1:]:
            similarity = calculate_jaccard_similarity(
                entity_sets[entity1],
                entity_sets[entity2]
            )
            
            if similarity > 0:
                similarities.append({
                    'source': entity1,
                    'target': entity2,
                    'similarity': similarity
                })
    
    return similarities
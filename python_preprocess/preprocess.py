import os
import sys
import json
import traceback
import numpy as np
from nltk.stem import PorterStemmer
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

### CONSTANTS ###

# Threshold for valid matches
MIN_SIMILARITY = 0.8

# Prefer 2-3 word phrases
PRIORITIZE_LENGTH = False

# Initialize tools
model = SentenceTransformer('all-MiniLM-L6-v2', device="cpu")
stemmer = PorterStemmer()


### Initializes PECS_PHRASES ###
def initialize():
    # Initialize with memory optimization
    os.environ["TOKENIZERS_PARALLELISM"] = "false"
    os.environ["OMP_NUM_THREADS"] = "1"

    # Load PECS data
    script_dir = os.path.dirname(os.path.abspath(__file__))
    json_path = os.path.join(script_dir, 'images.json')

    # Put PECS labels into a list
    PECS_PHRASES = []
    try:
        with open(json_path) as f:
            PECS_PHRASES = list(json.load(f).keys())
    except Exception as e:
        print(f"Error loading PECS data: {str(e)}", file=sys.stderr)
        PECS_PHRASES = []

    return PECS_PHRASES


### Generate 2-3 word phrases with single-word fallback ###
def generate_candidates(sentence):
    words = [stemmer.stem(w) for w in sentence.lower().split()]
    candidates = []
    
    # Generate 2-word phrases
    candidates.extend([' '.join(words[i:i+2]) for i in range(len(words)-1)])
    
    # Generate 3-word phrases
    candidates.extend([' '.join(words[i:i+3]) for i in range(len(words)-2)])
    
    # Single-word fallback (only if no longer matches found)
    if not PRIORITIZE_LENGTH:
        candidates.extend(words)
    
    # Remove duplicates
    return list(dict.fromkeys(candidates))


### Finds all starting positions where candidate appears in sentence ###
def find_subsequence_positions(sentence_words, candidate_words):
    positions = [] 
    for i in range(len(sentence_words) - len(candidate_words) + 1):
        match = True
        for j in range(len(candidate_words)):
            # Compare stemmed versions
            if stemmer.stem(sentence_words[i+j]) != candidate_words[j]:
                match = False
                break
        if match:
            positions.append(i)
    return positions


### Finds PECS match ###
def find_pecs_matches(input_sentence, PECS_PHRASES):
    # Preprocess
    words = input_sentence.title().split()
    stemmed_words = [stemmer.stem(w) for w in words]
    candidates = generate_candidates(input_sentence)

    # Embed all texts (basically vectorize all PECS words and all candidate words)
    pecs_embeddings = model.encode(PECS_PHRASES)
    candidate_embeddings = model.encode(candidates)
    
    # Calculate similarities
    sim_matrix = cosine_similarity(candidate_embeddings, pecs_embeddings)

    # Collect all potential matches
    raw_matches = []
    for i, candidate in enumerate(candidates):
        # sim_matrix is a similarity matrix where:
        # Rows = candidate phrases from the input.
        # Columns = PECS phrases.
        # Values = similarity scores (0 to 1).
        # np.argmax(sim_matrix[i]) finds the column index (i.e., which PECS phrase) that has the highest similarity for the current candidate (i).
        max_sim_idx = np.argmax(sim_matrix[i])
        score = sim_matrix[i][max_sim_idx]

        if score >= MIN_SIMILARITY:
            # Find all possible positions where this candidate appears
            candidate_words = candidate.split()
            for pos in find_subsequence_positions(stemmed_words, candidate_words):
                original_text = ' '.join(words[pos:pos+len(candidate_words)])
                raw_matches.append({
                    'start': pos,
                    'end': pos + len(candidate_words) - 1,
                    'text': original_text,  # Original unstemmed text
                    'pecs_match': PECS_PHRASES[max_sim_idx],
                    'score': float(score),
                    'length': len(candidate_words)
                })
    
    # Filter for non-overlapping matches, prioritizing highest scores/longest phrases
    final_matches = []
    covered_positions = set()
    
    # Sort by length (desc) then score (desc)
    raw_matches.sort(key=lambda x: (-x['length'], -x['score']))
    
    for match in raw_matches:
        positions = range(match['start'], match['end'] + 1)
        if not any(p in covered_positions for p in positions):
            covered_positions.update(positions)
            final_matches.append(match)
    
    # Sort matches by their appearance order in the sentence
    final_matches.sort(key=lambda x: x['start'])
    
    return final_matches


### ANSWER ###
def output(matches, input_sentence):
    if matches == []:
        return input_sentence
    else:
        return matches[0]["pecs_match"]

### MAIN ###
def main():

    PECS_PHRASES = initialize()

    try:
        # Read input from Node.js
        input_sentence = sys.stdin.read().strip()
        matches = find_pecs_matches(input_sentence, PECS_PHRASES)
        
        # Return JSON response
        response = {
            "input": input_sentence,
            "matches": matches,
            "top_match": output(matches, input_sentence)
        }

        print(json.dumps(response))  # Ensure JSON output
        sys.stdout.flush()  # Critical for production
        
    except Exception as e:
        error_response = {
            "error": str(e),
            "traceback": traceback.format_exc()
        }
        print(json.dumps(error_response), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
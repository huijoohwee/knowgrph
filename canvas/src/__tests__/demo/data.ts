


export const DEMO_HTML_CONTENT = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>AIAP Field Guide</title>
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "Course",
      "name": "AIAP Field Guide",
      "description": "A 12 months self-directed AI/ML learning journey to become an AI Engineer.",
      "provider": {
        "@type": "Organization",
        "name": "AI Singapore",
        "sameAs": "https://aisingapore.org"
      }
    }
    </script>
</head>
<body>
    <article>
        <h1>AIAP Field Guide (Version 4.0)</h1>
        <p>A 12 months self-directed AI/ML learning journey to become an AI Engineer.</p>

        <details open>
            <summary>Section 1: Fundamentals</summary>
            <p>These topics are the basics we expect all candidates applying for AIAP to have.</p>
            <ul>
                <li><strong>Programming</strong>: Python is the primary language. You should be comfortable with scripting, virtual environments (venv, conda), and data structures.</li>
                <li><strong>Data Manipulation</strong>: Proficiency in Pandas and NumPy for data cleaning and analysis is essential.</li>
                <li><strong>Version Control</strong>: Git is mandatory for collaboration. Understand commits, branches, and merges.</li>
                <li><strong>Database</strong>: Basic SQL knowledge to query data from relational databases.</li>
                <li><strong>Command Line</strong>: Familiarity with Bash/Shell scripting for automation.</li>
            </ul>
        </details>

        <details>
            <summary>Section 2: Machine Learning</summary>
            <p>In this section, we begin our journey with Machine Learning (Statistical Learning).</p>
            <ul>
                <li><strong>Concepts</strong>: Supervised Learning (Regression, Classification) and Unsupervised Learning (Clustering, PCA).</li>
                <li><strong>Libraries</strong>: Scikit-learn is the industry standard for traditional ML algorithms.</li>
                <li><strong>Evaluation</strong>: Understand metrics like Accuracy, Precision, Recall, F1-Score, and ROC-AUC.</li>
                <li><strong>Workflow</strong>: Data splitting (Train/Val/Test), Cross-Validation, and Hyperparameter Tuning.</li>
            </ul>
        </details>

        <details>
            <summary>Section 3: Deep Learning</summary>
            <p>Deep Learning powers modern AI systems.</p>
            <ul>
                <li><strong>Frameworks</strong>: TensorFlow and PyTorch are the two most popular frameworks. AI Engineers should know at least one.</li>
                <li><strong>Architectures</strong>: Convolutional Neural Networks (CNNs) for vision, Recurrent Neural Networks (RNNs) for time-series, and Transformers for NLP.</li>
                <li><strong>Ecosystem</strong>: Hugging Face provides pre-trained models for rapid deployment.</li>
            </ul>
        </details>

        <details>
            <summary>Section 4: Ethics and Governance</summary>
            <p>AI must be built and used ethically, fairly and responsibly.</p>
            <ul>
                <li><strong>Bias</strong>: Identifying and mitigating algorithmic bias in datasets and models.</li>
                <li><strong>Governance</strong>: Compliance with data protection laws (e.g., PDPC in Singapore).</li>
                <li><strong>Transparency</strong>: Explainable AI (XAI) to interpret model decisions.</li>
            </ul>
        </details>

        <details>
            <summary>Section 5: Practice</summary>
            <p>Put learning into practice by building an actual AI project.</p>
            <ul>
                <li><strong>Competitions</strong>: Kaggle is a great platform to test skills.</li>
                <li><strong>Projects</strong>: Build an end-to-end application (e.g., a recommendation system or a chatbot) and deploy it.</li>
            </ul>
        </details>
    </article>
</body>
</html>
`

import {
    BookOpen,
    Code2,
    GraduationCap,
    Brain,
    Target,
    Map,
    FileText,
    RefreshCw,
} from "lucide-react";

function EmptyState() {

    const features = [

        {
            icon: <BookOpen size={22} />,
            title: "Learn",
            desc: "Learn concepts from beginner to advanced."
        },

        {
            icon: <GraduationCap size={22} />,
            title: "Exam",
            desc: "University-style answers with diagrams."
        },

        {
            icon: <Code2 size={22} />,
            title: "Coding",
            desc: "Algorithms, code, dry run and complexity."
        },

        {
            icon: <Brain size={22} />,
            title: "Interview",
            desc: "Technical interview preparation."
        },

        {
            icon: <Target size={22} />,
            title: "Quiz",
            desc: "Practice MCQs with explanations."
        },

        {
            icon: <RefreshCw size={22} />,
            title: "Revision",
            desc: "Quick revision notes and formula sheets."
        },

        {
            icon: <FileText size={22} />,
            title: "Notes",
            desc: "Well-structured study notes."
        },

        {
            icon: <Map size={22} />,
            title: "Roadmap",
            desc: "Complete learning roadmap with timeline."
        }

    ];

    return (

        <div className="empty-state">

            <div className="empty-header">

                <h2>

                    👋 Welcome to NexusAI Education AI

                </h2>

                <p>

                    Your personal AI tutor for learning,
                    coding, university exams,
                    interview preparation,
                    quizzes,
                    revision,
                    notes and roadmaps.

                </p>

            </div>

            <div className="empty-grid">

                {

                    features.map((item, index) => (

                        <div

                            key={index}

                            className="empty-card"

                        >

                            <div className="empty-icon">

                                {item.icon}

                            </div>

                            <h3>

                                {item.title}

                            </h3>

                            <p>

                                {item.desc}

                            </p>

                        </div>

                    ))

                }

            </div>

            <div className="empty-footer">

                <p>

                    💡 Try asking:

                </p>

                <ul>

                    <li>

                        Teach me LangChain from beginner to advanced.

                    </li>

                    <li>

                        Explain Binary Search with Python.

                    </li>

                    <li>

                        Generate DBMS notes.

                    </li>

                    <li>

                        Create a Java roadmap.

                    </li>

                    <li>

                        Explain Operating System for 10 marks.

                    </li>

                </ul>

            </div>

        </div>

    );

}

export default EmptyState;
import React, { Component } from 'react';
import axios from 'axios';

const axiosGitHubGraphQL = axios.create({
  baseURL: 'https://api.github.com/graphql',
  headers: {
    Authorization: `bearer ${process.env.REACT_APP_GITHUB_PERSONAL_ACCESS_TOKEN}`
  }
});

const TITLE = 'React GraphQL GitHub Client';

const ADD_STAR = `
  mutation ($repositoryId : ID!) {
    addStar(input: {starrableId: $repositoryId}) {
      starrable {
        viewerHasStarred
      }
    }
  }
`;

const GET_ISSUES_OF_REPOSITORY = `
query ($organization: String!, $repository: String!, $cursor: String) {
  organization(login: $organization) {
    name
    url
    repository(name: $repository) {
      id
      name
      url
      viewerHasStarred
      stargazers {
        totalCount
      }
      issues(first: 5, after: $cursor, states: [OPEN]) {
        totalCount
        pageInfo {
          endCursor
          hasNextPage
        }
        edges {
          node {
            id
            title
            url
            reactions(last: 3) {
              edges {
                node {
                  id
                  content
                }
              }
            }
          }
        }
      }
    }
  }
}
`;

const getIssuesOfRepository = (path, cursor) => {
  const [organization, repository] = path.split('/');
  
  return axiosGitHubGraphQL.post('', {
    query: GET_ISSUES_OF_REPOSITORY,
    variables: { organization, repository, cursor }
  });
};

const addStarToRepository = repositoryId => {
  return axiosGitHubGraphQL.post('', {
    query: ADD_STAR,
    variables: { repositoryId }
  });
};

const resolveIssuesQuery = (queryResult, cursor) => (state) => {
  const { data, errors } = queryResult.data;

  if (!cursor) {
    return {
      organization: data.organization,
      errors
    }
  }

  const { edges: oldIssues } = state.organization.repository.issues;
  const { edges: newIssues } = data.organization.repository.issues;
  const updatedIssues = [...oldIssues, ...newIssues];
  
  return {
    organization: {
      ...data.organization,
      repository: {
        ...data.organization.repository,
        issues: {
          ...data.organization.repository.issues,
          edges: updatedIssues,
        },
      },
    },
    errors
  }
};

const resolveAddStarMutation = mutationResult => state => {
  const { viewerHasStarred } = mutationResult.data.data.addStar.starrable;
  const { totalCount } = state.organization.repository.stargazers;
  return {
    ...state,
    organization: {
      ...state.organization,
      repository: {
        ...state.organization.repository,
        viewerHasStarred,
        stargazers: { totalCount: totalCount + 1 }
      }
    }
  };
};

class App extends Component {
  state = {
    path: 'the-road-to-learn-react/the-road-to-learn-react',
    organization: null,
    errors: null
  };

  onStarRepository = (repositoryId, viewerHasStarred) => {
    addStarToRepository(repositoryId).then(mutationResult => 
      this.setState(resolveAddStarMutation(mutationResult))
    );
  };
  
  onFetchMoreIssues = () => {
    const { endCursor } = this.state.organization.repository.issues.pageInfo;
    this.onFetchFromGitHub(this.state.path, endCursor);
  };

  componentDidMount() {
    this.onFetchFromGitHub(this.state.path);
  }
  
  onChange = event => {
    this.setState({ path: event.target.value });
  };
  
  onSubmit = event => {
    this.onFetchFromGitHub(this.state.path);
    event.preventDefault();
  };

  onFetchFromGitHub = (path, cursor) => {
    getIssuesOfRepository(path, cursor).then(
      result => this.setState(resolveIssuesQuery(result, cursor))
    );
  };

  render() {
    const { path, organization, errors } = this.state;
    return (
      <div>
        <h1>{TITLE}</h1>

        <form onSubmit={this.onSubmit}>
          <label htmlFor="url">Show open issues for https://github.com/</label>
          <input id="url" type="text" value={path} onChange={this.onChange} style={{ width: '300px'}}/>
          <button type="submit">Search</button>
        </form>
        <hr/>

        { organization ? (
            <Organization 
              organization={organization} 
              errors={errors} 
              onFetchMoreIssues={this.onFetchMoreIssues}
              onStarRepository={this.onStarRepository}
            />
          ) : (
            <p>No information yet ...</p>
          )
        }
      </div>
    );
  }
}

const Organization = ({ organization, errors, onFetchMoreIssues, onStarRepository }) => {
  if (errors) {
    return (
      <p>
        <strong>Something went wrong:</strong>
        {errors.map(error => error.message).join(' ')}
      </p>
    );
  }
    
  return (
    <div>
      <p>
        <strong>Issues from Organization:</strong>
        <a href={organization.url}>{organization.name}</a>
      </p>
      <Repository 
        repository={organization.repository} 
        onFetchMoreIssues={onFetchMoreIssues}
        onStarRepository={onStarRepository}
      />
    </div>
  );
};

const Repository = ({ repository, onFetchMoreIssues, onStarRepository }) => (
  <div>
    <p>
      <strong>In Repository:</strong>
      <a href={repository.url}>{repository.name}</a>
    </p>

    <button 
      type="button" 
      onClick={() => 
        onStarRepository(repository.id, repository.viewerHasStarred)
        }>
      {repository.stargazers.totalCount} {repository.viewerHasStarred ? "Unstar" : "Star"}
    </button>
    
    <ul>
      {repository.issues.edges.map(issue => (
        <li key={issue.node.id}>
          <a href={issue.node.url}>{issue.node.title}</a>
          <ul>
            {issue.node.reactions.edges.map(reaction => (
              <li key={reaction.node.id}>{reaction.node.content}</li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
    <hr/>
    { repository.issues.pageInfo.hasNextPage && (
      <button onClick={onFetchMoreIssues}>More</button>
    )}
  </div>
);

export default App;